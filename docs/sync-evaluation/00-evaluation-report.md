# TaskTrees Sync Conflict Evaluation Report

> **Status**: Authoritative Reference Document  
> **Created**: 2026-02-10  
> **Scope**: Sync conflict avoidance algorithm robustness + UX feedback  
> **UX Principle**: Evernote-style — silent resolution preferred, confirmation dialogs only when data loss risk exists

---

## Architecture Overview

### Current Sync Flow
1. **Local edit** -> Zustand store -> 5s debounce -> IDB/Firebase save -> `updateTimeStamp`
2. **Server change detection**: Firebase `onValue` on `users/{uid}/timestamp` -> clientId check -> dirty flag check -> hash comparison -> merge/overwrite
3. **Conflict tracking**: `syncStateStore` captures `baseSnapshot` + `baseHash` when `markItemsDirty` is called

### Key Components
| Component | File | Role |
|-----------|------|------|
| Sync Observer | `src/hooks/useObserve.ts` | Firebase listener, conflict detection, debounced save |
| Sync Operations | `src/hooks/useSync.ts` | syncDb, checkAndSyncDb, copyTreeDataToIdbFromDb |
| Sync State | `src/store/syncStateStore.ts` | dirty flags, baseSnapshot, baseHash, lastServerHash |
| Sync Utilities | `src/utils/syncUtils.ts` | stableStringify, hashData, getClientId |
| Tree Management | `src/hooks/useTreeManagement.ts` | saveItems, loadAndSetCurrentTreeDataFromIdb, deleteTree |

---

## Evaluated Scenarios

### A: Offline -> Online Transition

#### A1: Single device offline editing then reconnect
- **Scenario**: User edits tasks offline, then reconnects
- **Current Behavior**: `markItemsDirty` captures base snapshot. On reconnect, `checkAndSyncDb` runs. If server unchanged (`serverHash === baseHash`), local pushed. Otherwise falls into conflict path.
- **Assessment**: Partially implemented. Happy path works. True conflict (server also changed) hits `console.warn` only — **no merge**.
- **Gap**: GAP-1 (no 3-way-merge)

#### A2: Multiple devices offline, both edit, both reconnect
- **Scenario**: Device A and B both offline, both edit same tree, A reconnects first, B reconnects second
- **Current Behavior**: Device A pushes successfully (server unchanged). Device B detects conflict (`serverHash !== baseHash && serverHash !== localHash`). Falls into `console.warn`.
- **Assessment**: Critical gap. Device B's changes are silently lost or stuck in dirty state.
- **Gap**: GAP-1 (no 3-way-merge)

### B: Multi-device Editing Conflicts

#### B1: Same tree, different tasks edited simultaneously
- **Scenario**: Device A edits task X, Device B edits task Y in the same tree
- **Current Behavior**: Second device to sync detects hash mismatch. Falls into `console.warn`. No field-level merge.
- **Assessment**: Should be silently resolvable — different tasks don't conflict. Critical gap.
- **Gap**: GAP-1 (no 3-way-merge)

#### B2: Same tree, same task edited simultaneously  
- **Scenario**: Both devices edit the same task's value field
- **Current Behavior**: `console.warn` — no resolution
- **Assessment**: True conflict. Needs field-level merge with last-write-wins for same fields or user prompt.
- **Gap**: GAP-1 (no 3-way-merge)

#### B3: Structural conflict — task moved on both devices
- **Scenario**: Device A moves task to folder X, Device B moves same task to folder Y
- **Current Behavior**: `console.warn` — no resolution
- **Assessment**: True structural conflict. Needs merge with one side winning (e.g., latest timestamp).
- **Gap**: GAP-1 (no 3-way-merge)

### C: Timing-related Race Conditions

#### C1: Edit during active sync
- **Scenario**: User edits while `isSyncing === true` 
- **Current Behavior**: Debounce save checks `isSyncing` and skips save. Edit is buffered in Zustand state.
- **Assessment**: **Well implemented**. Edit preserved in memory, will be saved after sync completes on next debounce cycle.

#### C2: Rapid tree switching during sync
- **Scenario**: User switches trees while sync is in progress
- **Current Behavior**: `itemsTreeId` guard prevents saving items to wrong tree. `resetAllSync` called on tree switch.
- **Assessment**: **Well implemented** after bug fix. Guards prevent cross-tree data corruption.

#### C3: Firebase listener fires during local save
- **Scenario**: Firebase `onValue` triggers while debounced save is executing
- **Current Behavior**: `isSyncing` flag provides mutual exclusion. Debounce save skips if syncing.
- **Assessment**: **Adequate**. Potential edge case if save completes between flag check and Firebase write, but low risk.

### D: Deletion & Sharing Member Scenarios

#### D1: Tree deleted on another device while user is editing
- **Scenario**: Device B deletes a tree that Device A is currently editing
- **Current Behavior**: `loadAndSetTreesListFromDb` updates trees list. If current tree disappears from list, no explicit detection or user notification.
- **Assessment**: Critical gap. User continues editing a deleted tree. Save may fail silently or create orphaned data.
- **Gap**: GAP-2 (no tree deletion detection)

#### D2: Sharing member removed while editing
- **Scenario**: Owner removes a member who is currently editing the shared tree
- **Current Behavior**: No detection. Member can continue editing locally. Next save may fail due to permission rules.
- **Assessment**: Important gap. Needs detection + local copy creation.
- **Gap**: GAP-3 (no edit permission loss detection)

#### D3: Owner deletes shared tree while member is editing
- **Scenario**: Same as D1 but for shared trees
- **Current Behavior**: Same as D1. No detection.
- **Assessment**: Same gap as D1, compounded by sharing context.
- **Gap**: GAP-2 (no tree deletion detection)

### E: Network Instability

#### E1: Connection drops mid-save
- **Scenario**: Network fails during Firebase write
- **Current Behavior**: Firebase SDK has built-in retry for writes. `isConnectedDb` updates via `.info/connected` listener.
- **Assessment**: **Adequate**. Firebase handles retries. If connection drops, `isConnectedDb` goes false and items save to IDB instead.

#### E2: Intermittent connectivity (flapping)
- **Scenario**: Connection rapidly toggles on/off
- **Current Behavior**: `isConnectedDb` updates in real-time. When offline, saves to IDB + marks dirty. When online, `checkAndSyncDb` reconciles.
- **Assessment**: **Adequate** for basic cases. Could produce many dirty snapshots but base snapshot is only captured once (first dirty mark).

#### E3: Partial sync failure (trees list synced but tree data fails)
- **Scenario**: Trees list updates from server but tree data fetch fails
- **Current Behavior**: Individual tree fetch errors would be caught by error handler. No rollback mechanism.
- **Assessment**: Minor gap. Trees list shows tree exists but local data is stale. Low risk with Firebase's built-in reliability.
- **Gap**: GAP-5 (no partial sync failure recovery)

---

## Identified Gaps Summary

| ID | Gap | Severity | Affected Scenarios | Phase |
|----|-----|----------|--------------------|-------|
| GAP-1 | No 3-way-merge for concurrent edits — `console.warn` only | **Critical** | A1, A2, B1, B2, B3 | Phase 1 |
| GAP-2 | No tree deletion detection while editing | **Critical** | D1, D3 | Phase 1 |
| GAP-3 | No edit permission loss detection (member removed) | **Important** | D2 | Phase 2 |
| GAP-4 | Offline integration lacks background auto-merge on reconnect | **Important** | A1, A2 | Phase 2 |
| GAP-5 | No partial sync failure recovery/rollback | **Minor** | E3 | Future |

---

## UX Design Principles (Evernote Model)

### Silent Resolution (No User Interaction)
- Different tasks edited on different devices -> auto-merge silently
- Same task, different fields edited -> auto-merge silently  
- Offline edits where server is unchanged -> push silently
- Tree metadata changes that don't conflict -> apply silently

### Notification Only (Toast/Snackbar, No Action Required)
- Successful auto-merge of concurrent edits -> brief toast: "Changes synced"
- Connection status changes -> connection indicator update

### Confirmation Dialog (User Decision Required)
- Same task, same field edited with different values -> show diff, let user choose
- Tree deleted while user was editing -> offer to save as new tree (local copy)
- Edit permission lost (member removed) -> notify + auto-save local copy

### Key UX Rule
> Data must NEVER be silently lost. When in doubt, create a local copy rather than discard changes.
