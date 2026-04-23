# Chanakya PM — Team Training Guide

Welcome to Chanakya, White Lotus Group's villa-construction project
management tool. This document walks you through everything you need
to get productive in your first 30 minutes.

- **Live URL:** https://chanakya-pm.onrender.com
- **Admin contact:** Vandana P (vandana.p@whitelotusgroup.in)
- **Best experienced on:** desktop / laptop, Chrome or Safari (mobile
  layout is not yet supported)

---

## 1. Signing in

You have two ways to sign in. **Google is preferred** — it's the fastest
and most secure.

### Option A — Sign in with Google (recommended)
1. Open https://chanakya-pm.onrender.com
2. Click **Sign in with Google**
3. Pick your `@whitelotusgroup.in` work account
4. You're in

First-time sign-in for people from `@whitelotusgroup.in` auto-creates an
account with **edit** permission. If you need elevated access (approve /
manage), ping Vandana.

### Option B — Email + password
If your account was pre-seeded with a password:
1. Enter your work email
2. Enter the shared default password (ask Vandana if you don't have it)
3. Click **Sign In**

Forgot your password? Email Vandana. Password self-reset isn't built in yet.

### Session length
- You stay signed in for **7 days**
- You'll see a warning banner **15 minutes before** your session expires
  so you can finish your edit and sign in again without losing work
- If the session expires mid-edit, you'll see "Your session has expired"
  and be returned to the login screen

---

## 2. Your first 2 minutes in the app

After signing in, you land on the **Select Development** screen:

- **Amanvana** and **Kandhavara** are the two main developments
- Click **Open Dashboard →** on the one you work with
- Or click **View All Developments** to see everything at once

Inside a development you'll see villa cards. Click any villa to open
its dashboard.

> **Tip:** The badge next to the Chanakya logo (top-left) shows which
> development you're in. Click it to go back to the Select Development
> screen.

---

## 3. The villa dashboard at a glance

Once inside a villa, the interface is organised into tabs:

| Tab | What it shows |
|---|---|
| **WBS** | The full task table — phases, subphases, and every task |
| **Gantt** | Visual timeline with bars, dependencies, critical path |
| **Report** | Daily / weekly / monthly progress reports |
| **Planner** | Week-by-week task planner |
| **Baselines** | Snapshots of schedule versions for comparison |
| **Critical Path** | The tasks that determine the project end date |
| **Calendar** | Tasks plotted on a calendar grid |
| **Resources** | Team / material allocation |
| **Costs** | Budget vs actual |
| **Approvals** | Items waiting for sign-off |

The left sidebar lists all villas in this development — click any villa
name to switch.

---

## 4. Common tasks

### Add a new task
Requires: **edit** permission

1. Open any villa → **WBS** tab
2. Click **+ Add Task** (top-right of the WBS toolbar)
3. Pick task type (group task or subtask)
4. Fill in name, dates, phase, status, progress
5. Optionally: add predecessors, assignee, cost, notes
6. Click **Save**

The task auto-saves to the server within 1.5 seconds. Other team
members will see it on their next refresh or automatically as they
work.

### Edit a task
1. Click the task row in the WBS tab
2. The task panel opens on the right
3. Edit any field → changes save automatically
4. Or click the task name to open the full edit modal

**Quick edits from the Gantt:**
- **Drag a task bar** left or right to shift its dates (preserves duration)
- A toast appears confirming the new dates with an **Undo** button

### Mark task as complete / in-progress / blocked
1. Click the task
2. Change **Status** dropdown to the new state
3. If status = **blocked** or **on-hold**, a "Blocking reason" field
   appears — fill it in so teammates know why

### Delete a task
1. Click the task → **Delete** button
2. A toast appears with an **Undo** button (6-second window)
3. After 6 seconds the delete is permanent

### Reschedule many tasks at once
Currently tasks are edited one at a time. To shift a whole phase or
villa, you can use the Gantt drag-to-reschedule for visual bulk moves,
or ask Praveer (Planner) to do a baseline replan.

### Import a CSV / Excel of tasks
Requires: **manage** permission

1. Click **Import** (top-right, visible only if you have manage access)
2. Choose **By Phase**, **By Villa**, or **WL Master Schedule** mode
3. Upload the file
4. Map columns if prompted
5. Preview → Import

### Export data
Requires: **manage** permission

1. Click **Export** (top-right)
2. A JSON backup file downloads
3. Every export is logged to the audit trail

### Capture a baseline
Requires: **edit** or **manage** permission

1. Open a villa → **Baselines** tab
2. Click **Capture New Baseline**
3. Give it a name ("Initial Schedule", "Revised Plan v2")
4. Optionally add notes
5. Click **Save**

Baselines are read-only snapshots of the current schedule. You can
compare any two later to see what changed.

### Request / approve an approval
Requires: **approve** permission to approve

1. Any user can **request** an approval from a task's panel
2. Users with **approve** permission (Pavan, Chetan, Vandana) see the
   Approvals tab with pending items
3. Approve or reject with a comment

### View the audit log
Requires: **manage** permission

1. Click the 📋 **Audit Log** button (header, top-right)
2. See the last 500 actions: who changed what, when

---

## 5. Who can do what

| Permission | What it unlocks |
|---|---|
| **view** | Read all villas, tasks, reports. No buttons for editing. |
| **edit** | Add / edit / delete tasks. Drag Gantt bars. Update progress. |
| **approve** | See Approvals panel. Approve / reject requests. |
| **manage** | Create new villas, Import, Export, + Add Development, Audit Log, ⚙ Manage panel. |

Permissions are independent — a user can have any combination.

### Current team roster

| Name | Role | Permissions |
|---|---|---|
| Admin | Administrator | all |
| Vandana P | Project Manager | edit, approve, manage |
| Praveer C | Planner | edit, manage |
| Vaishali P | Project Manager | edit, manage |
| Shraddha B | Project Manager | edit, manage |
| Dinesh | Project Manager | edit, manage |
| Madhavarajan S | Project Manager | manage |
| Pavan | Project Manager | approve |
| Chetan | Project Manager | approve |
| Stanly John | Project Manager | view |
| Product Analyst | Analyst | view |

Anyone else from `@whitelotusgroup.in` who signs in via Google gets
**edit** access automatically. Contact Vandana if you need elevated
permissions.

---

## 6. Working together — things to know

### Auto-save and conflicts
- Every change you make auto-saves to the server every ~1.5 seconds
- Other team members see your changes when they reload or next save
- If two people edit the same villa at the same time, whoever saves
  second sees a banner: **"Another user saved changes after you last
  synced — reload to see the latest, then retry your edit"**
- Click **Reload** — your unsaved change needs to be redone, but
  nobody's work is silently lost

### Offline / bad network
- If your connection drops, a yellow banner appears: **"Your changes
  aren't syncing to the server. Retrying…"**
- The app retries automatically every 5 seconds
- If saves keep failing for 30+ seconds, the banner turns red and
  asks you to stop editing until the connection is restored
- Click **Retry now** to force a retry, or **Reload** to start fresh

### What's logged
Every create, edit, delete, reschedule, import, export, and approval
is logged to the audit trail with your name and timestamp. Admins can
review the log at any time via the 📋 Audit Log button.

---

## 7. Keyboard & mouse shortcuts

| Action | Shortcut |
|---|---|
| Save task modal | **Enter** (when inside a text field) |
| Cancel modal | **Escape** |
| Quick-edit (WBS) | **Click a task cell** |
| Reschedule on Gantt | **Drag the bar** |
| Zoom Gantt | Use the zoom dropdown (Week / Month / Quarter) |

---

## 8. Troubleshooting

### "I can't log in"
- Double-check you're at `https://chanakya-pm.onrender.com`
- Try Google sign-in if password fails
- Admin contact: Vandana (vandana.p@whitelotusgroup.in)
- If you see a "Chanakya couldn't finish loading" screen, click the
  **Reload app** button. If it keeps happening, send a screenshot to
  Vandana.

### "Everything looks broken / raw code on screen"
Hard-reload (**Cmd+Shift+R** on Mac, **Ctrl+Shift+R** on Windows).
That clears the cached version. If still broken, report to Vandana.

### "The screen keeps saying 'Another user saved'"
Someone else is editing the same villa. Click **Reload**, then make
your edit again. If this happens repeatedly, coordinate with the
other person in Slack to avoid stepping on each other's changes.

### "I don't see the ⚙ Manage / Import / + New Villa button"
You don't have `manage` permission. That's expected for most users.
Ask Vandana if you need it.

### "Gantt chart is slow"
Try switching the zoom from **Week** to **Month** or **Quarter** —
fewer columns means faster rendering.

### "I accidentally deleted something"
If you deleted it within the last 6 seconds, a toast should be
visible with an **Undo** button. If it's been longer, ping Vandana —
she can restore from the audit log.

---

## 9. Known limitations

These are on the roadmap but not built yet:

- **Mobile / tablet layout** — desktop / laptop only for now
- **Password self-reset** — email Vandana if you forget yours
- **Photo / document attachments on tasks** — use shared drive or email
- **Realtime live updates** — you see other people's changes on reload
  or next save, not instantly. Usually no more than a couple of
  seconds' delay.
- **Bulk task editing** — one task at a time for now (except Gantt
  drag for date shifts)

---

## 10. Support & escalation

| Issue | Contact |
|---|---|
| Can't sign in | Vandana P |
| Need edit / approve / manage permission | Vandana P |
| Found a bug | Vandana P — include a screenshot of the error + browser console (Cmd+Option+J → Console tab) |
| Lost data / accidental deletion | Vandana P |
| Feature request | Vandana P |

---

## 11. Quick reference card

Print this if you want — it covers 90% of daily use.

```
  ┌──────────────────────────────────────────────────────────┐
  │  Chanakya PM — Daily cheat sheet                          │
  ├──────────────────────────────────────────────────────────┤
  │                                                            │
  │  Sign in      →  chanakya-pm.onrender.com → Sign in        │
  │                    with Google (work email)                │
  │                                                            │
  │  Pick dev     →  Amanvana / Kandhavara / View All          │
  │                                                            │
  │  Switch dev   →  Click ← badge next to Chanakya logo       │
  │                                                            │
  │  Add task     →  Villa → WBS → + Add Task                  │
  │                                                            │
  │  Edit task    →  Click task row → edit fields → auto-save  │
  │                                                            │
  │  Reschedule   →  Gantt → drag the bar left / right         │
  │                                                            │
  │  Undo delete  →  Click Undo in the toast (6 sec window)    │
  │                                                            │
  │  Sign out     →  Top-right → Sign out                      │
  │                                                            │
  │  Conflict?    →  Click "Reload" in the banner, re-edit     │
  │                                                            │
  │  Stuck?       →  Hard-reload (Cmd+Shift+R), then ping      │
  │                  Vandana with a screenshot                 │
  │                                                            │
  └──────────────────────────────────────────────────────────┘
```

---

*Last updated: April 2026 · Maintained by White Lotus Group*
