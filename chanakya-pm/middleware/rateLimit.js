/**
 * middleware/rateLimit.js — tiny in-memory sliding-window rate limiter.
 *
 * No external dependencies. Suitable for a single-instance Render web
 * service. Not suitable for multi-instance deployments (state isn't shared);
 * if we ever scale horizontally, swap this for Redis-backed express-rate-limit.
 *
 *   const limiter = createRateLimit({ windowMs: 60_000, max: 5, keyBy: 'ip' });
 *   app.post('/api/auth/login', limiter, handler);
 *
 * On block, responds 429 with Retry-After header and { error, retryAfter }.
 */

function createRateLimit({ windowMs, max, keyBy = 'ip', message } = {}) {
  if (!windowMs || !max) throw new Error('rateLimit: windowMs and max are required');

  // Map<string, number[]>  — key → array of request timestamps within the window
  const hits = new Map();

  // Periodic GC so the map doesn't grow unbounded on a long-lived process
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, arr] of hits) {
      const kept = arr.filter(t => t >= cutoff);
      if (kept.length) hits.set(k, kept); else hits.delete(k);
    }
  }, windowMs).unref?.();

  return function rateLimit(req, res, next) {
    let key;
    if (typeof keyBy === 'function') {
      key = keyBy(req);
    } else if (keyBy === 'ip') {
      // Render sits behind a proxy — trust X-Forwarded-For first hop
      key = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    } else if (keyBy === 'email') {
      key = String((req.body && req.body.email) || '').toLowerCase() || 'anon';
    } else {
      key = 'global';
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    const arr = (hits.get(key) || []).filter(t => t >= cutoff);

    if (arr.length >= max) {
      const oldest = arr[0];
      const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
        retryAfter,
      });
    }

    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

module.exports = { createRateLimit };
