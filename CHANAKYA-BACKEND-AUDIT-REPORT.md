# Chanakya PM v35 — Backend / Logic Structural Audit

**Date:** 13 April 2026
**Scope:** chanakya-pm-v35 (8).html — 11,545 lines, single monolithic file
**Purpose:** Identify structural problems, duplications, conflicts, and cleanup priorities before any feature work

---

## A. Key Backend Problems

### A1. No Single Source of Truth for Task Data

The system has **three independent task data stores** that can diverge silently:


| Store             | Location                         | Persisted?                     | Used By                                          |
| ----------------- | -------------------------------- | ------------------------------ | ------------------------------------------------ |
| `_realTasks[pid]` | In-memory object (line 1474)     | Via `_C.tasks` to localStorage | Task Sheet, Gantt, Calendar, Reports, Side Panel |
| `_PT[pid]`        | In-memory object (line ~8170)    | **NOT persisted**              | Planner view only                                |
| `genWBS()` output | Generated on-the-fly (line 1579) | Never                          | Fallback when `_realTasks[pid]` is undefined     |


`**DB.tasks()`** (line 1480) is the main accessor, but it regenerates data on every call — it checks `_realTasks[pid]` and falls back to `genWBS()`. There is no caching or staleness check. Every call to `DB.tasks()` creates a new array copy (`[..._realTasks[pid]]`), so two calls in the same render cycle return different object references.

The Planner operates on a completely separate store (`_PT[pid]`). Edits in the Planner are invisible to Task Sheet, Gantt, Reports, and all other views. Planner data is lost on page refresh.

### A2. Task Data Regeneration on Boot

`loadRealSchedule()` (lines 1642–5658) contains **~4,000 lines of hardcoded JSON** embedded directly in the source. On every boot (line 5912), this overwrites `_realTasks` for all known project IDs. Then `boot()` (lines 5901–5945) runs a "smart merge" that attempts to reconcile localStorage edits with the fresh hardcoded data. This merge has edge cases — for example, if the hardcoded task list changes between versions, user edits to tasks whose IDs no longer exist are silently dropped.

For VM001 and VM002 (model villas), localStorage is explicitly deleted on every boot (line 5916), meaning user edits to these projects are always discarded.

### A3. Dual `doCreateBaseline()` Definitions

Two functions with the same name exist:

- **Line 7476**: Standard version — reads from `DB.tasks()[pid]`
- **Line 8998**: Planner override version — reads from `_pData(pid)`

The second definition silently shadows the first. JavaScript does not warn about this. Which version runs depends entirely on whether the Planner code has loaded, not on which view the user is in. The planner version references `_planBlOverride` and `_origDoCreate()`, neither of which appears to be set anywhere in the codebase — likely dead/incomplete code.

### A4. No Baseline Persistence

`_blStore` (line 7430) is in-memory only. Baselines, approval requests, freeze records — all lost on page refresh. The server backup at `_scheduleSave()` (line 1509) sends projects, resources, and meta to `/api/backup`, but does not include baseline data.

### A5. Project Context Loss Causes False Blocking

`S.proj` (the active project reference) is set by `openProj(id)` (line 6313) and **cleared to null** when switching to dashboard (`showMain('dash')`, line 5856). At least 8 functions guard with `if(!S.proj) return` or show "Open a project first" toasts. This means any navigation to the dashboard wipes the project context, and the user must re-open the project to do anything.

---

## B. Duplicate / Conflicting Logic Found

### B1. Three Forward/Backward Pass Implementations


| Implementation                     | Lines     | Used By                             |
| ---------------------------------- | --------- | ----------------------------------- |
| `_pForward()` / `_pBackward()`     | 8296–8387 | Planner scheduling (`_pSchedule`)   |
| `_pForwardOn()` / `_pBackwardOn()` | 9443–9492 | Critical Path fallback (`renderCP`) |
| Forward/backward inside `calcCP()` | 7303–7340 | Gantt critical path highlighting    |


These are ~87% duplicate code. A bug fix in one will not propagate to the others.

### B2. Two Topological Sort Implementations

- `_pTopoSort()` (line 8249): Kahn's algorithm, used by Planner
- Inline topo sort in `calcCP()` (line 7283): Separate Kahn's implementation, used by Gantt

### B3. Two Dependency Editing Systems

- **Task Sheet side panel**: `addPred()` / `rmPred()` (lines 6707–6718) — text-based input, minimal validation, saves to `_realTasks` via `DB.sTasks()`
- **Planner dependency editor**: `openDepEditor()` / `depEditorSave()` (lines 9157–9267) — full modal UI with dropdowns, type selectors, lag fields, saves to `_PT[pid]` only

### B4. Two Task Move Systems

- **Task Sheet**: `mvUp(id)` / `mvDn(id)` (lines 6577–6587) — operates on `_realTasks`, calls `DB.sTasks()`
- **Planner**: `planMoveUp()` / `planMoveDown()` (lines 8794–8814) — operates on `_PT[pid]`, calls `_pSet()`

Reordering in one view has no effect on the other.

### B5. Auto-Wiring Applied at Render Time, Not Persisted

`_autoWireDeps()` (lines 7218–7253) generates predecessor relationships within subphases by task order. It is called inside `renderGantt()` (line 6906) — meaning dependencies are recalculated every time Gantt renders. These auto-wired dependencies are NOT saved back to storage. The Planner does not call `_autoWireDeps()` at all, so the same project will show different dependency chains in Gantt vs. Planner.

### B6. Notes Logic — Overwrite in Every Path


| Function                                | View           | Behavior           | Persists            |
| --------------------------------------- | -------------- | ------------------ | ------------------- |
| `saveTask()` (line 6863)                | Task Modal     | Overwrites `notes` | Yes (DB.sTasks)     |
| `saveTPNotes()` (line 6706)             | Side Panel     | Overwrites `notes` | Yes (DB.sTasks)     |
| `planTPUpdate('notes',...)` (line 9118) | Planner Panel  | Overwrites `notes` | **No** (only _pSet) |
| `_pEditCommit()` (line 8884)            | Planner inline | Overwrites `notes` | **No** (only _pSet) |


All four paths overwrite notes rather than appending. The Planner paths don't persist at all.

---

## C. Logic That Should Be Removed

### C1. `genWBS()` Fallback in `DB.tasks()` (line 1483)

When `_realTasks[pid]` is undefined, `DB.tasks()` silently generates random synthetic tasks. For a production tool, this is dangerous — it makes new projects appear to have hundreds of tasks with fake dates, fake assignees, and fake progress. A new project should start empty.

### C2. `_pForwardOn()` / `_pBackwardOn()` (lines 9443–9492)

Duplicate scheduling code used only as a fallback in `renderCP()`. Should be replaced by calls to the primary `_pForward()` / `_pBackward()`.

### C3. Inline Forward/Backward in `calcCP()` (lines 7303–7340)

Third copy of scheduling logic. Should delegate to the centralized scheduler.

### C4. `setBaseline()` / `clearBL()` Legacy Shims (lines 8154–8161)

`setBaseline()` just calls `openCreateBaseline()`. `clearBL()` only shows a toast. Neither adds value.

### C5. Second `doCreateBaseline()` (line 8998)

Shadows the first definition. Contains references to undefined variables (`_planBlOverride`, `_origDoCreate`). Dead code path.

### C6. Hardcoded Task Data in `loadRealSchedule()` (lines 1642–5658)

~4,000 lines of inline JSON that should be externalized to a data file. This makes the codebase nearly unreadable and prevents any data management strategy.

### C7. `_autoWireDeps()` at Render Time (called in line 6906)

Auto-generating dependencies every render is unpredictable and non-deterministic from the user's perspective. Should be a one-time import action, or removed entirely.

### C8. Task Baseline Fields in `genWBS()` (lines 1615–1617)

`genWBS()` bakes `baselineStart`, `baselineEnd`, `baselineSet` into every generated task. These fields are never used by the actual baseline system (`_blStore`), which snapshots tasks independently. The fields create confusion about where baseline data lives.

---

## D. Logic That Should Be Centralized

### D1. Scheduling Engine

Currently scattered across: `_pSchedule()`, `_pForwardOn/_pBackwardOn`, `calcCP()`, and implicit "no scheduling" in Task Sheet. Should be one function called from everywhere.

### D2. Task Save/Persist

Currently: `DB.sTasks()` for Task Sheet paths, `_pSet()` for Planner paths, direct `_realTasks[pid]=` assignment in some import paths (line 10986). Should be one save function that writes to one store and handles persistence.

### D3. Dependency Storage and Editing

Two separate dependency editing UIs, two save paths, auto-wiring at render time. Should be one dependency model with one editor.

### D4. Critical Path Calculation

Three implementations. Should be one `calculateCriticalPath(tasks)` function used by Gantt, Planner, and CP view.

### D5. Baseline Creation and Storage

Two `doCreateBaseline()` functions, in-memory-only storage. Should be one creation function with proper persistence to localStorage and server.

### D6. Project Context Management

`S.proj` is set/cleared inconsistently. Should be managed through a central `setActiveProject(id)` / `clearActiveProject()` with proper guards.

### D7. Date Arithmetic

Three date representations in use: ISO strings (`YYYY-MM-DD`), Date objects, and days-since-epoch (in `calcCP`). Should standardize on one.

### D8. Task Ordering

Task Sheet, Gantt, and Planner each maintain independent orderings. Should be one canonical order stored with the task data.

---

## E. Risks If Current Structure Is Not Fixed

### E1. Data Loss (CRITICAL)

- Planner edits are lost on every page refresh (no persistence)
- Baselines are lost on every page refresh (no persistence)
- VM001/VM002 edits are forcibly deleted on every boot

### E2. Silent Data Divergence (CRITICAL)

- Same project shows different task data in Task Sheet vs. Planner
- Same project shows different dependencies in Gantt (auto-wired) vs. Planner (manual)
- Same project shows different critical paths depending on which view calculates it

### E3. Scheduling Inconsistency (HIGH)

- Editing a task in Task Sheet does NOT reschedule dependents
- Editing a task in Planner DOES reschedule dependents
- Users will get different project end dates depending on which view they use

### E4. False Blocking (MEDIUM)

- Navigating to dashboard and back requires re-opening the project
- Functions fail silently when `S.proj` is null

### E5. Unmaintainable Codebase (HIGH)

- 11,545 lines in a single file
- ~4,000 lines of hardcoded JSON
- Three copies of scheduling algorithms
- Two copies of dependency editing
- No tests, no modules, no separation of concerns

### E6. Import Data Loss (MEDIUM)

- `_importTasks()` (line 10986) writes directly to `_realTasks` without calling `DB.sTasks()`, so imported data may not persist to localStorage
- Planner import is destructive (overwrites entire plan with no undo)

---

## F. Recommended Cleanup Order Before Feature Work

### Phase 1: Stabilize Data Layer (do first)

1. **Unify task storage** — eliminate `_PT[pid]` as a separate store; make Planner read/write from the same `_realTasks` source via `DB.sTasks()`
2. **Remove `genWBS()` fallback** from `DB.tasks()` — new projects should start with an empty task list, not randomly generated data
3. **Externalize hardcoded data** — move `loadRealSchedule()` JSON to an external file loaded on boot
4. **Fix `_importTasks()`** — ensure all import paths call `DB.sTasks()` for persistence
5. **Persist baselines** — add `_blStore` to localStorage save and server backup

### Phase 2: Consolidate Scheduling (do second)

1. **Create one `schedule(tasks)` function** that runs forward pass, backward pass, and critical path in one call
2. **Remove** `_pForwardOn()`, `_pBackwardOn()`, and the inline scheduling in `calcCP()`
3. **Make Task Sheet edits trigger rescheduling** — when a task's dates or duration change, cascade to dependents
4. **Remove `_autoWireDeps()`** from render — either wire on import/creation or remove entirely

### Phase 3: Consolidate UI Save Paths (do third)

1. **Create one `updateTask(pid, taskId, changes)` function** that handles validation, scheduling cascade, persistence, and re-rendering
2. **Merge dependency editors** — one UI, one save path
3. **Fix notes** — decide append-only vs. overwrite; implement consistently across all views
4. **Remove legacy shims** — `setBaseline()`, `clearBL()`, second `doCreateBaseline()`

### Phase 4: Fix State Management (do fourth)

1. **Fix `S.proj` lifecycle** — don't clear on dashboard navigation; or persist project ID and restore on tab switch
2. **Centralize task ordering** — one canonical order, all views respect it
3. **Standardize date handling** — one format, one set of utility functions

### Phase 5: Structural Refactor (do last, before adding features)

1. **Split monolithic file** into modules (data layer, scheduler, views, utilities)
2. **Add validation** — task data integrity checks on save
3. **Add basic tests** — at minimum for scheduling, critical path, and save/load round-trip

---

## Appendix: Key Line References


| Component                                       | Lines       |
| ----------------------------------------------- | ----------- |
| DB / Storage layer                              | 1450–1542   |
| State object (`S`)                              | 1544–1556   |
| `genWBS()` (synthetic task generator)           | 1579–1637   |
| `loadRealSchedule()` (hardcoded data)           | 1642–5658   |
| `initSamples()` (project seeding)               | 5776–5843   |
| `boot()` (initialization + merge)               | 5901–5951   |
| `syncProjStatus()`                              | 5958–5971   |
| `renderWBS()` / Task Sheet                      | 6428–6522   |
| `saveTask()` (modal save)                       | 6863+       |
| `cycSt()` (status toggle)                       | 6536        |
| `mvUp()` / `mvDn()`                             | 6577–6587   |
| `openTP()` / Side Panel                         | 6605–6722   |
| `saveTPNotes()`                                 | 6706        |
| `addPred()` / `rmPred()`                        | 6707–6718   |
| `renderGantt()`                                 | 6901+       |
| `_autoWireDeps()`                               | 7218–7253   |
| `calcCP()`                                      | 7258–7340   |
| Baseline system (`_blStore`)                    | 7430–8161   |
| `doCreateBaseline()` (first)                    | 7476        |
| Planner system (`_PT`)                          | 8170–9155   |
| `_pSchedule()` / `_pForward()` / `_pBackward()` | 8296–8407   |
| `_pEditCommit()`                                | 8884–8924   |
| `doCreateBaseline()` (second, shadows first)    | 8998        |
| `openDepEditor()` / `depEditorSave()`           | 9157–9267   |
| `renderCP()` / Critical Path                    | 9294–9500   |
| `_pForwardOn()` / `_pBackwardOn()` (duplicate)  | 9443–9492   |
| Import: Google Sheets                           | 9784–10168  |
| Import: WLMS / MS Project                       | 10183–10611 |
| Import: Generic CSV/JSON                        | 10622–11000 |
