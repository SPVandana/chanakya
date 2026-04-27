# Chanakya PM — Handover & Continuity Checklist

This document captures the operational items that must be done by a human
(I cannot do them for you because they require dashboard access, account
ownership, or company-account coordination).

---

## 1. Credentials vault (do once, share with second admin)

Capture every secret in a shared password manager (1Password / Bitwarden /
Dashlane — anything with sharing). Right now if any of these is lost,
recovery is messy.

| Item | Where it lives today | Why it matters |
|---|---|---|
| `JWT_SECRET` | Render dashboard → chanakya-pm → Environment | If lost, every active session breaks. If exposed, attackers can mint valid tokens. |
| `GOOGLE_CLIENT_ID` | Render dashboard env vars + Google Cloud Console | Google login breaks if lost. (Public ID, not strictly secret.) |
| Admin password (`admin@chanakya.in`) | Currently `admin123` (default) — should be rotated | The most powerful login. |
| Render account login | Vandana's email | Without this, no one can deploy, change env vars, restart, or view logs. |
| GitHub account / repo access | `SPVandana` personal account | Without this, no one can push code or view the repo. |
| Render API key (used by `.github/workflows/deploy.yml`) | GitHub repo Secrets | If exposed, attackers can deploy arbitrary code. |
| Google Cloud Console login | Whoever owns the OAuth project | Required to add/remove authorised JS origins, e.g. for staging URLs. |

### Suggested vault structure
```
Chanakya PM/
  ├── Render account             (email + password + 2FA backup codes)
  ├── Render env vars            (JWT_SECRET, GOOGLE_CLIENT_ID, AUTO_PROVISION_DOMAINS, DATA_DIR)
  ├── GitHub account             (SPVandana — or the whitelotusgroup org once migrated)
  ├── GitHub deploy secrets      (RENDER_API_KEY, RENDER_SERVICE_ID — both used by deploy.yml)
  ├── Google Cloud project       (OAuth client owner login + 2FA backup)
  ├── Admin app password         (admin@chanakya.in current password)
  └── Service info               (Render service ID, deploy URL, persistent disk size, billing card last 4)
```

### Sharing
Share the vault with at minimum **one other person** — Praveer is the
obvious second admin (already promoted to `edit, approve, manage`).

---

## 2. Second admin readiness (mostly already done in code)

In-app permissions: ✅ Praveer C now has `edit, approve, manage` (the
full trio). He can add/edit users (by editing `data/users.json` and
pushing), see the audit log, approve workflow items, and import/export.

What's still on you:
  - [ ] Share the credentials vault (above) with Praveer
  - [ ] Add Praveer as a Render dashboard collaborator (Render → Account
        Settings → Team)
  - [ ] Add Praveer as a GitHub collaborator on `SPVandana/chanakya`
        (or migrate the repo to a `whitelotusgroup` org — see #4 below)
  - [ ] Walk Praveer through one redeploy + one user-add (so he's done it
        once before he ever has to do it under pressure)

---

## 3. Repo & IP ownership

Today the code lives at `https://github.com/SPVandana/chanakya` — a
personal GitHub account. This creates two material risks:

  - If Vandana leaves White Lotus, the company effectively loses access
    to its own production code.
  - The IP technically belongs to whoever pushed the commits unless
    there's an explicit assignment in writing.

### Two ways to fix

**Option A — Migrate the repo to a `whitelotusgroup` GitHub org**
  1. Create / use the existing `whitelotusgroup` org on GitHub
  2. From `SPVandana/chanakya` → Settings → scroll down to "Transfer
     ownership" → enter `whitelotusgroup` as the new owner
  3. After transfer, update the Render dashboard's connected repo to
     point at `whitelotusgroup/chanakya` (Render dashboard →
     chanakya-pm → Settings → Build & Deploy → Connected Repository)
  4. Update GitHub Actions secrets if any reference the old org
  5. Confirm a deploy still works end-to-end

**Option B — Sign an IP assignment agreement**
  Cheaper option if migrating is awkward. Document in writing that
  Vandana assigns the copyright and any IP rights in the Chanakya
  codebase to White Lotus Group, dated and counter-signed. Keep a copy
  with the company's legal documents.

Either is fine. Option A is cleaner long-term.

---

## 4. Google Cloud Console ownership

The OAuth client `638036945919-…` was created in some Google Cloud
project. That project is owned by some Google account. Confirm:

  - [ ] Which Google account owns the GCP project that issued the
        OAuth client? Personal or company?
  - [ ] If personal: add a second owner (a `@whitelotusgroup.in`
        account) so the org doesn't lose access if that personal
        account is closed.
  - [ ] If company: capture the login in the credentials vault.

GCP Console → IAM & Admin → IAM → Add member → role "Owner".

---

## 5. Pre-launch confidence test (after persistent disk is added)

Run this 10-minute test the moment the disk is live, BEFORE inviting
the team:

  - [ ] Sign in as admin
  - [ ] Create a villa called "DELETEME-PERSISTENCE-TEST"
  - [ ] Push any tiny commit (e.g. add a comment to README, push, wait
        for Render to redeploy)
  - [ ] Refresh the app, sign in again, confirm "DELETEME-PERSISTENCE-TEST"
        is still there
  - [ ] Delete it
  - [ ] Also delete the leftover "test", "tester", "qwer" dev rows from
        the DB (Render Shell → `sqlite3 /app/data/chanakya.db` →
        `UPDATE app_data SET projs = json_remove(projs, '$.test', '$.tester', '$.qwer') WHERE id=1;`)

If the test villa is gone after redeploy, the disk is NOT working —
the `DATA_DIR` env var probably isn't pointing at the mount path.

---

## 6. Day-1 rollout plan

Recommended order:

  1. **Disk added + persistence test passed** ✅
  2. **You + Praveer + Vandana + Vaishali pilot** — 4 people, 2-3 days
  3. **30-min Zoom training** — walk the pilot group through Import,
     Gantt drag, conflict-banner-reload, baseline workflow
  4. **Open to the remaining 7 users** — send the training PDF + a
     Slack/email with the URL and "use Google sign-in"
  5. **Watch Render logs daily for the first week** — `Render
     dashboard → chanakya-pm → Logs`. If anything looks like an error
     stack trace or a 500, screenshot and ping me.

---

*Last updated: 2026-04-24*
