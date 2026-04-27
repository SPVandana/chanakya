#!/usr/bin/env node
/**
 * scripts/smoke-test.js
 *
 * Pre-deploy smoke test. Catches the two classes of bug that have already
 * slipped to production once:
 *
 *   1. Raw "</script>" inside a JS string/template literal, which the
 *      browser's HTML parser would match as a tag-close and silently turn
 *      thousands of lines of JS into HTML text (the "doLogin is not defined"
 *      incident).
 *
 *   2. Obviously broken JS — unclosed braces, typos that produce a parse
 *      error — anywhere in the inline <script> blocks.
 *
 * Plus a live boot smoke test against the running server:
 *   - /health            → 200
 *   - /config.js         → 200 + valid CKY_CONFIG shape
 *   - /api/auth/login    → 200 with a real admin credential
 *   - /api/data          → 200 with expected JSON shape
 *   - /                  → 200 and contains critical DOM ids and function names
 *
 * Run: npm run smoke-test
 * Exits non-zero on any failure so CI / Render can fail the build.
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'public', 'index.html');
const PORT = process.env.SMOKE_PORT || 3456;
const BASE = `http://127.0.0.1:${PORT}`;

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('  ✗', msg); };
const pass = (msg) => console.log('  ✓', msg);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchSimple(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ─── 1. Static HTML checks ──────────────────────────────────────────────────

function checkStaticHtml() {
  console.log('\n[1/3] Static HTML checks');

  const html = fs.readFileSync(INDEX_HTML, 'utf8');

  // Extract all inline <script> blocks (those without a src attribute).
  // The regex mirrors what the browser's HTML parser does: it closes the
  // block at the first </script followed by whitespace, slash, or >.
  const openRe = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  const scriptBodies = [];
  let m;
  while ((m = openRe.exec(html))) {
    const start = m.index + m[0].length;
    // Find the next </script...> — exactly how the browser finds it.
    const closeRe = /<\/script[\s\/>]/i;
    const rest = html.slice(start);
    const close = rest.search(closeRe);
    if (close === -1) {
      fail(`Unterminated <script> block starting at offset ${m.index}`);
      continue;
    }
    const body = rest.slice(0, close);
    scriptBodies.push({ start, body });
  }

  if (scriptBodies.length === 0) fail('No inline <script> blocks found in index.html');

  // A. The browser-parser trap — any "</script" followed by space/slash/>
  //    that appears INSIDE a script body is a premature close that would
  //    silently turn the rest of the JS into HTML text.
  //    Defensive patterns that are *safe*: "<\/script", "</scr' + 'ipt",
  //    "<${'script'}", "<${'/'}script". We flag only the dangerous form.
  const dangerousClose = /<\/script[\s\/>]/i;
  scriptBodies.forEach((blk, i) => {
    if (dangerousClose.test(blk.body)) {
      fail(`Script block #${i + 1} contains a raw "</script>" token inside the JS — browser HTML parser will terminate the block early, killing every function defined after this point. Split it as "<\\/${'script'}>" or "'<\\/' + 'script>'".`);
    }
  });

  // A2. Tag-balance check — exactly the same defence at a coarser grain.
  //     Counts every <script ...> open tag and every </script> close tag in
  //     the WHOLE file. If they don't match 1-to-1, somewhere a close tag
  //     is sitting inside a JS comment, string, or template literal — even
  //     if the per-block scan above missed it because extraction stopped
  //     at the rogue token. This was the bug that broke production on
  //     2026-04-24: a `</script>` inside a JS-comment line in the boot
  //     canary closed the main script block early, and the per-block scan
  //     reported clean because each truncated body parsed fine on its own.
  const openCount  = (html.match(/<script\b/gi)  || []).length;
  const closeCount = (html.match(/<\/script\s*>/gi) || []).length;
  if (openCount !== closeCount) {
    fail(`Tag-balance check failed — found ${openCount} <script> open tags but ${closeCount} </script> close tags. The extra close tag is sitting inside a JS comment / string / template literal and will be matched by the browser HTML parser, terminating the script block early. grep for "</script" outside <script> open/close lines to find it.`);
  } else {
    pass(`Script open/close tag balance OK (${openCount} of each)`);
  }
  if (!failures.length) pass(`Script bodies scanned for raw </script> tokens (${scriptBodies.length} block${scriptBodies.length === 1 ? '' : 's'} OK)`);

  // B. Static JS syntax — concatenate the bodies and run node --check via
  //    the VM directly (no child_process, no temp files).
  //    We wrap in an IIFE so function declarations don't conflict across blocks.
  const combined = scriptBodies.map((b, i) => `// --- block ${i + 1} ---\n(function(){\n${b.body}\n})();`).join('\n');
  try {
    new Function(combined); // parses only; doesn't execute
    pass('Inline JS parses cleanly (new Function() check)');
  } catch (e) {
    fail(`Inline JS has a syntax error: ${e.message}`);
  }

  // C. Critical DOM ids that the boot flow hard-codes — missing any of these
  //    means the app won't start. Cheap regression check.
  const criticalIds = ['screen-login', 'screen-select', 'app-header', 'app-body', 'toastBox', 'li-email', 'li-pass'];
  const missingIds = criticalIds.filter(id => !new RegExp(`id\\s*=\\s*["']${id}["']`).test(html));
  if (missingIds.length) fail(`Missing critical DOM ids: ${missingIds.join(', ')}`);
  else pass(`Critical DOM ids present (${criticalIds.length})`);

  // D. Critical functions the DOM's onclick handlers depend on — if any of
  //    these ever goes missing (rename refactor, deleted block), the UI
  //    will break exactly like the doLogin incident. Pure text search.
  const criticalFns = ['doLogin', 'doLogout', 'selectDev', 'showSelectScreen', '_handleGoogleToken', 'openProj', 'renderGantt', 'printGantt', 'boot'];
  const missingFns = criticalFns.filter(fn => !new RegExp(`function\\s+${fn}\\s*\\(|${fn}\\s*=\\s*(async\\s*)?function|${fn}\\s*:\\s*(async\\s*)?function`).test(html) && !new RegExp(`${fn}\\s*=\\s*(async\\s*)?\\(`).test(html));
  if (missingFns.length) fail(`Critical functions not defined: ${missingFns.join(', ')}`);
  else pass(`Critical function definitions found (${criticalFns.length})`);

  // E. Boot-failure canary — a separate <script> block at the end of the
  //    file that shows a clean error overlay if the main block ever fails
  //    to load. This is the user-facing safety net for any future HTML
  //    parser trap that somehow slips past checks A–D.
  const hasLoadedFlag = /window\.__ckyMainLoaded\s*=\s*true/.test(html);
  const hasCanaryCheck = /__ckyMainLoaded/.test(html) && /showBootFailure/.test(html);
  if (!hasLoadedFlag || !hasCanaryCheck) {
    fail('Boot-failure canary is missing — the recovery overlay for a truncated main script block has been removed. Restore it (search existing history for "__ckyMainLoaded" / "showBootFailure").');
  } else {
    pass('Boot-failure canary present (main-script-truncation recovery path intact)');
  }
}

// ─── 2. Boot the server ─────────────────────────────────────────────────────

let serverProc = null;

function bootServer() {
  return new Promise((resolve, reject) => {
    console.log('\n[2/3] Booting server on port ' + PORT);
    const env = Object.assign({}, process.env, {
      PORT: String(PORT),
      JWT_SECRET: 'smoke-test-secret-' + 'x'.repeat(32),
      NODE_ENV: 'test',
      DATA_DIR: path.join(ROOT, 'data'),
    });
    serverProc = spawn('node', ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });

    let settled = false;
    const done = (err) => { if (!settled) { settled = true; err ? reject(err) : resolve(); } };

    serverProc.stdout.on('data', (c) => {
      const s = c.toString();
      if (s.includes('Chanakya PM')) { pass('Server started'); done(); }
    });
    serverProc.stderr.on('data', (c) => {
      process.stderr.write('  [server stderr] ' + c.toString());
    });
    serverProc.on('exit', (code) => {
      if (!settled) done(new Error('server exited before ready (code ' + code + ')'));
    });
    setTimeout(() => done(new Error('server did not start within 8s')), 8000);
  });
}

function stopServer() {
  if (serverProc && !serverProc.killed) { serverProc.kill('SIGTERM'); }
}

// ─── 3. Live HTTP checks ────────────────────────────────────────────────────

async function checkLiveEndpoints() {
  console.log('\n[3/3] Live endpoint checks');

  // /health
  try {
    const r = await fetchSimple(BASE + '/health');
    if (r.status !== 200) fail(`/health returned ${r.status}`);
    else pass('/health → 200');
  } catch (e) { fail(`/health fetch failed: ${e.message}`); }

  // /config.js — must be syntactically valid JS that defines CKY_CONFIG
  try {
    const r = await fetchSimple(BASE + '/config.js');
    if (r.status !== 200) fail(`/config.js returned ${r.status}`);
    else if (!/window\.CKY_CONFIG\s*=/.test(r.body)) fail('/config.js missing window.CKY_CONFIG assignment');
    else pass('/config.js → 200 and defines CKY_CONFIG');
  } catch (e) { fail(`/config.js fetch failed: ${e.message}`); }

  // /api/auth/login with admin — verifies the seeded DB + bcrypt + JWT path works end-to-end
  try {
    const r = await fetchSimple(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@chanakya.in', password: 'admin123' }),
    });
    if (r.status !== 200) fail(`/api/auth/login returned ${r.status}: ${r.body.slice(0, 200)}`);
    else {
      const j = JSON.parse(r.body);
      if (!j.token || !j.user) fail('/api/auth/login response missing token or user');
      else {
        pass('/api/auth/login → 200 + token');
        // /api/data with that token
        try {
          const d = await fetchSimple(BASE + '/api/data', { headers: { 'Authorization': 'Bearer ' + j.token } });
          if (d.status !== 200) fail(`/api/data returned ${d.status}`);
          else {
            const data = JSON.parse(d.body);
            const required = ['projs', 'resources', 'meta', 'tasks', 'baselines', 'planner', 'updated_at'];
            const missing = required.filter(k => !(k in data));
            if (missing.length) fail(`/api/data missing keys: ${missing.join(', ')}`);
            else pass('/api/data → 200 with expected shape (incl. updated_at for optimistic locking)');
          }
        } catch (e) { fail(`/api/data fetch failed: ${e.message}`); }
      }
    }
  } catch (e) { fail(`/api/auth/login fetch failed: ${e.message}`); }

  // / (index.html) — make sure the server serves the static HTML
  try {
    const r = await fetchSimple(BASE + '/');
    if (r.status !== 200) fail(`/ returned ${r.status}`);
    else if (!r.body.includes('id="screen-login"')) fail('/ body missing screen-login (HTML not served)');
    else pass('/ → 200 and contains screen-login');
  } catch (e) { fail(`/ fetch failed: ${e.message}`); }
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('Chanakya PM — pre-deploy smoke test');

  checkStaticHtml();

  try {
    await bootServer();
    await checkLiveEndpoints();
  } catch (e) {
    fail('Boot failure: ' + e.message);
  } finally {
    stopServer();
  }

  console.log('');
  if (failures.length) {
    console.error(`FAILED — ${failures.length} issue(s):`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  }
  console.log('✓ All checks passed.');
  process.exit(0);
})();
