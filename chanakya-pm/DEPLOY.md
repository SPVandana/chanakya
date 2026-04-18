# Chanakya PM — Deployment & Update Guide

## Architecture

```
GitHub repo: SPVandana/chanakya
  └── chanakya-pm/        ← Express app (rootDir for Render)
        ├── server.js
        ├── public/index.html
        └── db/db.js      reads DB from /data (env: DATA_DIR)

Render.com
  ├── Web Service (free tier)  — auto-deploys on git push to main
  └── Persistent Disk /data (1GB, ~$0.25/mo)
        └── chanakya.db    ← SQLite, survives every redeploy
```

All 12 users hit the same URL → same database → always in sync.
Updates are a `git push origin main` — Render rebuilds in ~90s, disk untouched.

---

## First-Time Setup (do this once)

### 1. Commit the backend to GitHub

From the repo root (`Chanakya Project Management tool/`):

```bash
# Stage all deployment files
git add render.yaml
git add chanakya-pm/

# Commit
git commit -m "add chanakya-pm backend and Render deployment config"

# Push to main
git push origin main
```

### 2. Create a Render account and connect the repo

1. Go to [render.com](https://render.com) → Sign up (free)
2. Dashboard → **New +** → **Web Service**
3. Connect your GitHub account → select `SPVandana/chanakya`
4. Render detects `render.yaml` at the repo root → click **Apply**
5. Render creates the web service AND the persistent disk automatically

### 3. Verify environment variables in Render dashboard

After the first deploy, open your service → **Environment** and confirm:
- `DATA_DIR` = `/data`
- `JWT_SECRET` = (auto-generated, looks like a random string)
- `NODE_ENV` = `production`

### 4. App is live

Your app will be at: `https://chanakya-pm.onrender.com` (Render assigns the URL)

Share this URL with your 12 users. Login with server-mode credentials:
- Admin: `admin@chanakya.in` / `admin123`
- Others: `pavan@whitelotusgroup.in` / `wlg123` (etc.)

To reset/change passwords: edit `data/users.json` (use a `"password"` field for
plain-text — the seed script bcrypt-hashes it), commit, and push.

### 5. Migrate your existing project data (one-time)

If you have existing data in `data/chanakya-data.json` locally:

1. Open the live app → log in as admin
2. Use **Import** in the app (if available), OR
3. Via Render Shell (Dashboard → your service → Shell):
   ```bash
   node scripts/migrate-data.js
   ```

---

## Bi-Monthly Feature Updates

Standard workflow — safe for every update:

```bash
# 1. Create a branch
git checkout -b feature/my-update

# 2. Develop and test locally
npm run dev          # auto-restart at http://localhost:3000

# 3. Merge to main
git checkout main
git merge feature/my-update

# 4. Push → Render auto-deploys (~90 seconds)
git push origin main
```

### What happens on every redeploy

| Component              | What happens                             |
|------------------------|------------------------------------------|
| `public/index.html`    | Replaced with new version                |
| `server.js`, routes    | Replaced with new version                |
| `/data/chanakya.db`    | **Untouched** — lives on persistent disk |
| User sessions          | JWT tokens stay valid (same secret)      |

Zero data loss. Users may see a brief reconnect (~90s downtime during restart).

---

## Taking a Backup Before a Big Update

From Render Shell (Dashboard → your service → Shell):

```bash
cp /data/chanakya.db /data/chanakya-backup-$(date +%Y%m%d).db
```

Or download via the app's Export button (Admin panel).

---

## Adding / Changing Users

Edit `chanakya-pm/data/users.json` — add a new entry with a plain-text
`"password"` field and the seed script will bcrypt-hash it on next deploy:

```json
{
  "id": "u9",
  "email": "newuser@whitelotusgroup.in",
  "name": "New User",
  "role": "viewer",
  "password": "ChangeMe009!"
}
```

```bash
git add chanakya-pm/data/users.json
git commit -m "add new user"
git push origin main
```

---

## Costs

| Item                          | Cost             |
|-------------------------------|------------------|
| Render Web Service (free tier)| $0/month         |
| Render Persistent Disk (1 GB) | ~$0.25/month     |
| **Total**                     | **~$0.25/month** |

**Note:** Render free tier web services spin down after 15 min of inactivity
(~30s cold start on first request after idle). To avoid this, upgrade to
Starter plan ($7/month) or use a free uptime monitor (e.g. UptimeRobot)
to ping the app every 10 minutes.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Login fails on live site | Using server-mode passwords? Check Render → Logs |
| Data missing after redeploy | Check Render → Disks — verify `/data` is mounted |
| Seed fails on deploy | Check `chanakya-pm/data/users.json` is committed |
| App crashes | Render auto-restarts; check Logs for the error message |
