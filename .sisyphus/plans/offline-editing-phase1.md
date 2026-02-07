# Offline Editing with Sync Resolution — Phase 1

## TL;DR

> **Quick Summary**: Enable editing while disconnected by adding sync metadata (dirty/baseSnapshot/baseHash), removing `isConnectedDb` gates that block local saves, implementing smart reconnection logic that detects whether the server changed, and replacing the blocking spinner with an offline banner.
>
> **Deliverables**:
> - New `src/utils/syncUtils.ts` — hashing, stable JSON, clientId management
> - New `src/store/syncStateStore.ts` — per-document sync metadata (dirty, baseSnapshot, baseHash, lastServerHash)
> - New `src/components/OfflineBanner.tsx` — non-blocking offline indicator
> - Modified `src/hooks/useObserve.ts` — rewritten Firebase listener with decision algorithm, removed isConnectedDb save gates
> - Modified `src/hooks/useSync.ts` — updateTimeStamp tags writes with clientId
> - Modified `src/hooks/useTreeManagement.ts` — saveItems updates sync metadata
> - Modified `src/hooks/useAppStateManagement.ts` — saveQuickMemo updates sync metadata
> - Modified `src/store/appStateStore.ts` — add clientId state
> - Modified `src/services/databaseService.ts` — saveItemsDb/saveTimeStampDb include clientId
> - Modified `src/features/homepage/HomePage.tsx` — swap spinner for offline banner when disconnected
>
> **Estimated Effort**: Medium (8-12 focused tasks)
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 5 → Task 6 → Task 8

---

## Context

### Original Request
Add offline editing with sync resolution to TaskTrees — Phase 1 only. The simplest, most impactful phase: allow editing while disconnected, silently push local edits when server is unchanged, show an offline banner instead of a blocking spinner.

### Key Architectural Facts (from code reading)

**Current sync flow**:
1. App startup: IDB loads → `setIsLoading(false)` → Firebase `onValue` listener registered
2. Firebase `onValue` on `users/{uid}/timestamp`: if `serverTs > localTs` → reload ALL from Firebase → overwrite local state
3. Items auto-save effect (5s debounce): gated by `(!isConnectedDb && !isOffline)` — blocks saves when disconnected
4. Memo auto-save effect (3s debounce): gated similarly
5. `saveItems()`: `dbService.saveItemsDb()` → `idbService.saveItemsToIdb()` → `updateTimeStamp()`
6. Connection checker (useObserve.ts:170-180): sets `isLoading=true` when disconnected → shows spinner

**Two different "offline" concepts**:
- `isOffline` (appStateStore): True for anonymous/logged-out offline mode — uses Capacitor Preferences storage, creates "offline trees"
- `isConnectedDb` (appStateStore): Firebase RTDB connection state — false when network drops for logged-in users

**The `isConnectedDb` gates** appear in:
- `useObserve.ts:215` — items save effect early return
- `useObserve.ts:298` — memo save effect early return
- `useTreeManagement.ts` — 8 locations (handleSaveTreesList, deleteTree, handleCreateNewTree, handleLoadedContent, handleFileUpload, handleTreeNameSubmit, handleAddUserToTree, handleDeleteUserFromTree, handleChangeIsArchived)

**Firebase writes**: `databaseService.saveItemsDb()` uses `set()` (full overwrite). `saveTimeStampDb()` writes to `users/{uid}/timestamp`, `users/{uid}/timestampV2`, `trees/{treeId}/timestamp`, and notifies other members via Cloud Function.

### Design Decisions (pre-agreed)

**State model** per syncable document (items, memo):
```
dirty: boolean          — local has unsaved changes
baseSnapshot: T         — data at moment user first edited (for future merge base)
baseHash: string        — hash of baseSnapshot for fast comparison
lastServerHash: string  — hash of last known server data
```

**Decision algorithm**:
```
onRemoteSnapshot(R):
  if (!dirty):
    if hash(R) == hash(local): no-op (A1/B4)
    else: apply server (A3/B3)
  if (dirty):
    if hash(R) == baseHash: push local silently (A2/B1)
    else if hash(R) == hash(local): convergence, clear dirty
    else: DEFER to Phase 2 (keep local, show warning banner)
```

**Own-echo detection**: Tag Firebase writes with `clientId` (stable UUID per install, stored in localStorage). On `onValue`, if write's clientId matches ours → treat as confirmation, not remote change.

**Hashing**: cyrb53 or similar fast non-crypto hash on stable JSON (`JSON.stringify` with sorted keys).

### Metis-equivalent Self-Review

**Identified gaps (addressed in plan)**:
1. Race condition on reconnect: Firebase `onValue` fires + debounced save may fire simultaneously → need to suppress save-during-sync
2. `isOffline` vs `isConnectedDb` confusion: Plan explicitly distinguishes them. We only modify `isConnectedDb` gates for logged-in users.
3. Where to store clientId: localStorage (simplest, browser-only) — Capacitor Preferences would work for mobile but localStorage is sufficient for web
4. baseSnapshot memory cost: acceptable for Phase 1 — only one tree loaded at a time
5. Connection observer sets `isLoading=true` when disconnected → must change to NOT set isLoading for connection drops

---

## Work Objectives

### Core Objective
Allow logged-in users to continue editing tree items and quick memo while temporarily disconnected from Firebase, and intelligently sync those edits when connection restores.

### Concrete Deliverables
- Sync metadata store tracking dirty state per document
- Hash utility for fast data comparison
- ClientId generation and tagging on Firebase writes
- Rewritten Firebase `onValue` listener with decision algorithm
- IDB-only saving when disconnected (existing debounce effects, minus the gate)
- Offline banner component replacing blocking spinner
- Warning banner for deferred Phase 2 conflicts

### Definition of Done
- [ ] User can edit tree items while disconnected — edits persist in IDB
- [ ] User can edit quick memo while disconnected — edits persist in IDB
- [ ] On reconnection, if server data unchanged: local edits push silently to Firebase
- [ ] On reconnection, if no local edits: server data applies as before
- [ ] On reconnection, if both changed: local edits kept, warning banner shown (Phase 2 deferred)
- [ ] Own Firebase writes don't trigger a redundant reload
- [ ] Disconnection shows "Offline" banner, NOT a blocking spinner
- [ ] Existing online behavior is preserved — no regressions for connected users

### Must Have
- Sync metadata (dirty, baseHash, lastServerHash) for items and memo
- ClientId tagged on all Firebase writes
- Offline banner with MUI styling consistent with app theme
- IDB saves continue working when disconnected
- Stable JSON hashing utility

### Must NOT Have (Guardrails)
- **No 3-way merge algorithm** — Phase 2
- **No conflict resolution dialog/UI** — Phase 2
- **No multi-user conflict handling** — Phase 2
- **No per-item granular saves** — Phase 2
- **No changes to `isOffline` (anonymous offline mode)** — that's a separate concept entirely
- **No changes to Firebase RTDB security rules** — clientId is metadata only
- **No new npm dependencies for hashing** — use a simple inline hash function
- **Do not modify the Dexie schema version** — sync metadata lives in Zustand only (ephemeral per session), not persisted to IDB. baseSnapshot is in-memory only.
- **Do not break the existing `updateTimeStamp` → Cloud Function notification flow** — just add clientId field alongside timestamp

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks verified by agent-executed scenarios. No "user manually tests" criteria.

### Test Decision
- **Infrastructure exists**: YES — project uses Vite, likely has test capability, but no test files observed
- **Automated tests**: NO (not setting up test infra in this phase)
- **Agent-Executed QA**: ALWAYS — primary verification for all tasks

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Foundation, no dependencies):
├── Task 1: Create sync utilities (hash, stableStringify, clientId)
├── Task 2: Create sync state store
└── Task 3: Create OfflineBanner component

Wave 2 (After Wave 1 — Integration, depends on foundation):
├── Task 4: Tag Firebase writes with clientId
├── Task 5: Remove isConnectedDb gates on save effects (useObserve)
├── Task 6: Rewrite Firebase onValue listener with decision algorithm
├── Task 7: Update saveItems/saveQuickMemo to track dirty state
└── Task 8: Replace spinner with OfflineBanner for disconnection

Wave 3 (After Wave 2 — Final integration):
└── Task 9: End-to-end integration verification & edge case hardening
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4, 5, 6, 7 | 2, 3 |
| 2 | None | 5, 6, 7 | 1, 3 |
| 3 | None | 8 | 1, 2 |
| 4 | 1 | 6 | 5 (after 1 done) |
| 5 | 1, 2 | 6 | 4, 7 |
| 6 | 1, 2, 4, 5 | 9 | 7, 8 (after deps met) |
| 7 | 1, 2 | 6 | 4, 5 |
| 8 | 3 | 9 | 4, 5, 6, 7 |
| 9 | All | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2, 3 | 3 parallel agents (quick/quick/visual-engineering) |
| 2 | 4, 5, 6, 7, 8 | Sequential recommended: 4→5→7→6, then 8 in parallel |
| 3 | 9 | Single deep agent for integration verification |

---

## TODOs

- [ ] 1. Create sync utilities module (`src/utils/syncUtils.ts`)

  **What to do**:
  - Create `src/utils/syncUtils.ts` with these exports:
    - `stableStringify(data: unknown): string` — deterministic JSON.stringify with sorted keys (recursive). Must handle nested objects, arrays (preserve order), and undefined/null consistently.
    - `hashString(str: string): string` — cyrb53 hash function returning a string. Use the well-known cyrb53 implementation (53-bit hash, fast, good distribution).
    - `hashData(data: unknown): string` — convenience: `hashString(stableStringify(data))`
    - `getClientId(): string` — returns stable UUID for this browser install. On first call, generates `crypto.randomUUID()`, stores in `localStorage` under key `tasktrees_client_id`. Subsequent calls return the stored value.
  - The `stableStringify` function must sort object keys alphabetically at every nesting level. Arrays maintain their element order (elements not sorted). `undefined` values in objects are omitted (same as JSON.stringify). Handle circular references by throwing (not silently ignoring).

  **Must NOT do**:
  - Do NOT install any npm packages — all utilities are hand-written
  - Do NOT use `JSON.stringify` replacer alone (it doesn't sort keys)
  - Do NOT use crypto.subtle for hashing (overkill, async)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with well-defined pure functions, no dependencies on codebase
  - **Skills**: [`git-master`]
    - `git-master`: For committing after creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/utils/appStateUtils.ts` — Existing utils file pattern in this project (check for naming/export conventions)
  - `src/services/databaseService.ts:70-82` — The `removeUndefined` function shows how the project handles JSON cleaning — stableStringify must handle similar cases

  **External References**:
  - cyrb53 hash: https://github.com/nicolo-ribaudo/cyrb53 — reference implementation of the 53-bit hash function. Use the following implementation pattern:
    ```
    function cyrb53(str: string, seed = 0): number {
      let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
      for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
      h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
      h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909);
      return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    }
    ```
    Return as string: `return cyrb53(str).toString(36)`

  **Acceptance Criteria**:
  - [ ] File `src/utils/syncUtils.ts` exists and exports `stableStringify`, `hashString`, `hashData`, `getClientId`
  - [ ] `stableStringify({b:1, a:2})` returns `{"a":2,"b":1}` (keys sorted)
  - [ ] `stableStringify({a: {c:1, b:2}})` returns `{"a":{"b":2,"c":1}}` (nested sort)
  - [ ] `hashData({b:1, a:2}) === hashData({a:2, b:1})` (order-independent for objects)
  - [ ] `hashData([1,2,3]) !== hashData([3,2,1])` (order-dependent for arrays)
  - [ ] `getClientId()` returns same value on repeated calls
  - [ ] `getClientId()` value is stored in `localStorage.getItem('tasktrees_client_id')`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify syncUtils exports compile and work correctly
    Tool: Bash (node/bun)
    Preconditions: Project builds successfully
    Steps:
      1. Run: npx tsc --noEmit src/utils/syncUtils.ts (or whole project check)
      2. Assert: No TypeScript errors
    Expected Result: Clean compilation
    Evidence: Terminal output captured

  Scenario: Verify stableStringify determinism
    Tool: Bash (bun)
    Preconditions: syncUtils.ts created
    Steps:
      1. Create a small test script that imports stableStringify and runs:
         - stableStringify({b:1, a:2}) === '{"a":2,"b":1}'
         - stableStringify({a:{c:1,b:2}}) === '{"a":{"b":2,"c":1}}'
         - stableStringify([3,1,2]) === '[3,1,2]'
      2. Run the script
      3. Assert: All comparisons return true
    Expected Result: Deterministic output regardless of key insertion order
    Evidence: Script output captured
  ```

  **Commit**: YES
  - Message: `feat(sync): add sync utilities — stableStringify, cyrb53 hash, clientId`
  - Files: `src/utils/syncUtils.ts`

---

- [ ] 2. Create sync state store (`src/store/syncStateStore.ts`)

  **What to do**:
  - Create a new Zustand store `src/store/syncStateStore.ts` that tracks sync metadata for each syncable document type
  - Define types:
    ```typescript
    type SyncDocumentMeta<T = unknown> = {
      dirty: boolean;
      baseSnapshot: T | null;    // data at moment of first edit (for future merge)
      baseHash: string;           // hash of baseSnapshot
      lastServerHash: string;     // hash of last known server data
    };

    type SyncState = {
      // Per-document sync metadata
      itemsSync: SyncDocumentMeta<TreeItems>;
      memoSync: SyncDocumentMeta<string>;

      // Sync status flags
      isSyncing: boolean;         // true during reconnection sync to suppress concurrent saves

      // Actions for items
      markItemsDirty: (currentItems: TreeItems) => void;
      clearItemsDirty: () => void;
      setItemsServerHash: (hash: string) => void;
      setItemsBaseFromServer: (items: TreeItems, hash: string) => void;

      // Actions for memo
      markMemoDirty: (currentMemo: string) => void;
      clearMemoDirty: () => void;
      setMemoServerHash: (hash: string) => void;
      setMemoBaseFromServer: (memo: string, hash: string) => void;

      // Global sync actions
      setIsSyncing: (syncing: boolean) => void;
      resetAllSync: () => void;
    };
    ```
  - Implementation details:
    - `markItemsDirty(currentItems)`: If not already dirty, capture `baseSnapshot = currentItems`, compute `baseHash = hashData(currentItems)`, set `dirty = true`. If already dirty, do nothing (keep original base).
    - `clearItemsDirty()`: Reset dirty=false, baseSnapshot=null, baseHash='' (but keep lastServerHash)
    - `setItemsServerHash(hash)`: Update lastServerHash
    - `setItemsBaseFromServer(items, hash)`: Set baseSnapshot, baseHash, lastServerHash all at once (used when applying server data)
    - Same pattern for memo actions
    - `resetAllSync()`: Reset everything to initial state (used on logout/tree switch)
  - Import `hashData` from `src/utils/syncUtils.ts`
  - Store is NOT persisted (ephemeral — resets on page reload, which is fine since IDB has the data and we re-sync on load)

  **Must NOT do**:
  - Do NOT persist this store to IDB or localStorage — it's ephemeral
  - Do NOT add sync metadata for treesList or settings yet — Phase 1 focuses on items and memo only
  - Do NOT use Zustand `persist` middleware

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with well-defined types and simple state logic
  - **Skills**: [`git-master`]
    - `git-master`: For committing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 5, 6, 7
  - **Blocked By**: None (but references syncUtils types — agent should create the file expecting the import to resolve after Task 1 lands)

  **References**:

  **Pattern References**:
  - `src/store/treeStateStore.ts` — Zustand store pattern used in this project (create(), type definition, set())
  - `src/store/appStateStore.ts` — Another Zustand store example, shows persist middleware usage (which we explicitly do NOT want here)
  - `src/types/types.ts:20` — `TreeItems` type definition needed for generic parameter

  **API/Type References**:
  - `src/types/types.ts:TreeItems` — The type for tree items array
  - `src/utils/syncUtils.ts:hashData` — Import path for hash utility (created in Task 1)

  **Acceptance Criteria**:
  - [ ] File `src/store/syncStateStore.ts` exists with `useSyncStateStore` export
  - [ ] TypeScript compiles with no errors
  - [ ] Store has `itemsSync` and `memoSync` with correct shape
  - [ ] `markItemsDirty` sets dirty=true and captures baseSnapshot only on first call
  - [ ] `clearItemsDirty` resets dirty but preserves lastServerHash
  - [ ] `isSyncing` flag exists and defaults to false

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify store compiles and has correct initial state
    Tool: Bash
    Preconditions: Both syncUtils.ts and syncStateStore.ts created
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: No TypeScript errors
    Expected Result: Clean build
    Evidence: Terminal output

  Scenario: Verify store shape via import check
    Tool: Bash
    Preconditions: Store file exists
    Steps:
      1. Create a temp script that imports useSyncStateStore, calls getState(),
         and logs Object.keys of the state
      2. Assert: Keys include itemsSync, memoSync, isSyncing, markItemsDirty, etc.
    Expected Result: All expected keys present
    Evidence: Console output captured
  ```

  **Commit**: YES
  - Message: `feat(sync): add sync state store for dirty tracking and hash comparison`
  - Files: `src/store/syncStateStore.ts`

---

- [ ] 3. Create OfflineBanner component (`src/components/OfflineBanner.tsx`)

  **What to do**:
  - Create `src/components/OfflineBanner.tsx` — a non-blocking banner that shows when `isConnectedDb === false` and user is logged in (not in anonymous offline mode)
  - Design:
    - Fixed position banner at the top of the viewport (below any existing app bar)
    - MUI `Alert` or `Paper` component with `severity="warning"` style
    - Text: "オフライン — 編集内容はローカルに保存されます" (Offline — edits are saved locally)
    - Small, non-intrusive — does NOT block interaction
    - Dismissible is NOT needed (it auto-hides when connection restores)
    - Use MUI `Slide` or `Collapse` transition for smooth show/hide
    - Must respect dark mode theme
  - Also create a secondary variant for the "deferred conflict" warning:
    - Show when Phase 2 conflict is detected (server changed + local dirty + hashes don't match)
    - Text: "サーバーとの変更の競合が検出されました。ローカルの変更を保持しています。" (Conflict detected with server. Keeping local changes.)
    - `severity="error"` style
    - This banner is controlled by a prop, not by reading isConnectedDb
  - Component props:
    ```typescript
    type OfflineBannerProps = {
      // No props needed — reads from stores directly
    };
    ```
  - The component internally reads `isConnectedDb`, `isOffline`, and `isLoggedIn` from appStateStore
  - Show condition: `isLoggedIn && !isOffline && !isConnectedDb`
  - For conflict banner: read from syncStateStore (a new `hasConflictWarning` derived value)

  **Must NOT do**:
  - Do NOT make it block user interaction (no overlay, no pointer-events:none on content)
  - Do NOT show it in anonymous offline mode (`isOffline === true`)
  - Do NOT add a dismiss button — it auto-clears
  - Do NOT use absolute positioning that might overlap the tree editor content — use a sticky/fixed bar that pushes content down or floats above

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with MUI styling, animations, dark mode support
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For polished UI component with proper MUI integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/features/homepage/HomePage.tsx:115-132` — Current loading spinner implementation — this is what we're REPLACING for disconnection scenarios
  - `src/store/appStateStore.ts:6-7,57-58` — `isOffline` and `isConnectedDb` state flags and their defaults

  **Documentation References**:
  - MUI Alert: `https://mui.com/material-ui/react-alert/` — Component API for the banner
  - MUI Collapse: `https://mui.com/material-ui/transitions/#collapse` — Transition for show/hide

  **Acceptance Criteria**:
  - [ ] File `src/components/OfflineBanner.tsx` exists and exports `OfflineBanner`
  - [ ] Component renders an MUI Alert with warning severity when offline
  - [ ] Component does NOT render when `isOffline === true` (anonymous mode)
  - [ ] Component does NOT render when connected (`isConnectedDb === true`)
  - [ ] Component uses theme-aware colors (works in both light and dark mode)
  - [ ] Component has smooth enter/exit transition
  - [ ] TypeScript compiles with no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify component compiles
    Tool: Bash
    Preconditions: Component file created
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: No TypeScript errors
    Expected Result: Clean build
    Evidence: Terminal output

  Scenario: Visual verification of offline banner
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in
    Steps:
      1. Navigate to app
      2. Use browser DevTools to set isConnectedDb to false in Zustand store
         (via window.__ZUSTAND_STORE__ or React DevTools)
      3. Assert: Banner appears with "オフライン" text
      4. Screenshot: .sisyphus/evidence/task-3-offline-banner.png
    Expected Result: Yellow/warning banner visible at top of page
    Evidence: .sisyphus/evidence/task-3-offline-banner.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add non-blocking OfflineBanner component for disconnection state`
  - Files: `src/components/OfflineBanner.tsx`

---

- [ ] 4. Tag Firebase writes with clientId

  **What to do**:
  - Modify `src/services/databaseService.ts` `saveTimeStampDb()` to ALSO write a `lastWriteClientId` field alongside the timestamp:
    ```typescript
    // In saveTimeStampDb, after writing timestamp:
    const clientIdRef = ref(getDatabase(), `users/${uid}/lastWriteClientId`);
    await set(clientIdRef, getClientId());
    ```
  - This field is written to `users/{uid}/lastWriteClientId` in Firebase, next to the existing `timestamp` field
  - Import `getClientId` from `src/utils/syncUtils.ts`
  - Also write `lastWriteClientId` on the tree-level timestamp path:
    ```typescript
    // When writing tree timestamp:
    const treeClientIdRef = ref(getDatabase(), `trees/${targetTree}/lastWriteClientId`);
    await set(treeClientIdRef, getClientId());
    ```
  - **Important**: Do NOT change the function signature or return type of `saveTimeStampDb`. Just add the extra writes internally.
  - Add a new export function to databaseService:
    ```typescript
    export const loadLastWriteClientIdFromDb = async (uid: string): Promise<string | null> => {
      const clientIdRef = ref(getDatabase(), `users/${uid}/lastWriteClientId`);
      const snapshot = await get(clientIdRef);
      return snapshot.exists() ? snapshot.val() : null;
    };
    ```

  **Must NOT do**:
  - Do NOT change Firebase RTDB security rules
  - Do NOT modify the Cloud Function `updateTimestamps` call signature
  - Do NOT remove or reorder existing writes in `saveTimeStampDb`
  - Do NOT change the `saveItemsDb` function yet (the clientId is on the timestamp write, not the items write)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small surgical modifications to existing service file
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Wave 1)
  - **Parallel Group**: Wave 2a (with Task 5, 7)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (needs getClientId)

  **References**:

  **Pattern References**:
  - `src/services/databaseService.ts:10-46` — `saveTimeStampDb` function — the EXACT function to modify. Note the existing pattern: write timestampV2, then timestamp, then tree timestamp, then notify members.
  - `src/services/databaseService.ts:1` — Import pattern at top of file

  **API/Type References**:
  - `src/utils/syncUtils.ts:getClientId` — Function to import (created in Task 1)

  **Acceptance Criteria**:
  - [ ] `saveTimeStampDb` writes `lastWriteClientId` to `users/{uid}/lastWriteClientId`
  - [ ] `saveTimeStampDb` writes `lastWriteClientId` to `trees/{targetTree}/lastWriteClientId` when targetTree is not null
  - [ ] `loadLastWriteClientIdFromDb` function exported and working
  - [ ] Existing timestamp write behavior unchanged
  - [ ] TypeScript compiles with no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify databaseService compiles
    Tool: Bash
    Preconditions: syncUtils.ts exists (Task 1 complete)
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: No TypeScript errors
    Expected Result: Clean build
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat(sync): tag Firebase timestamp writes with clientId for own-echo detection`
  - Files: `src/services/databaseService.ts`

---

- [ ] 5. Remove isConnectedDb gates on save effects in useObserve.ts

  **What to do**:
  - Modify the **items auto-save effect** (useObserve.ts, line ~215):
    - Change: `if ((!uid && !isOffline) || !currentTree || (!isConnectedDb && !isOffline))` 
    - To: `if ((!uid && !isOffline) || !currentTree)`
    - This allows the save effect to run when disconnected (for logged-in users)
  - Modify the **memo auto-save effect** (useObserve.ts, line ~298):
    - Change: `if ((!uid && !isOffline) || (!isConnectedDb && !isOffline) || !quickMemoText)`
    - To: `if ((!uid && !isOffline) || !quickMemoText)`
  - In both save effects, modify the save logic to be **connection-aware**:
    - When `isConnectedDb === true`: save to Firebase + IDB (existing behavior via `saveItems`/`saveQuickMemo`)
    - When `isConnectedDb === false`: save to IDB ONLY (call `idbService.saveItemsToIdb` / `idbService.saveQuickMemoToIdb` directly)
  - Add a guard: if `isSyncing` is true (from syncStateStore), skip the debounced save entirely (to prevent race conditions during reconnection sync)
  - When saving to IDB-only (disconnected), also call `markItemsDirty(items)` / `markMemoDirty(memo)` on the syncStateStore

  **Must NOT do**:
  - Do NOT change the debounce timing (5s for items, 3s for memo)
  - Do NOT remove the `isOffline` checks — those gate anonymous offline mode which uses Capacitor Preferences
  - Do NOT modify the `saveImmediately` function yet — that's used for visibilitychange/beforeunload and should get similar treatment but keep it simple
  - Do NOT change the timer/alarm check logic (the setInterval for 60s timer checks)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Modifying critical sync logic in a complex hook with multiple interacting effects
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1, 2)
  - **Parallel Group**: Wave 2a (with Tasks 4, 7)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2 (needs syncUtils and syncStateStore)

  **References**:

  **Pattern References**:
  - `src/hooks/useObserve.ts:207-289` — Items save effect — THE code to modify. Key lines:
    - Line 215: The `isConnectedDb` gate to remove
    - Lines 259-275: The conditional save logic (offline vs online) to expand
    - Lines 246-280: The debounce timer and save call
  - `src/hooks/useObserve.ts:291-333` — Memo save effect — similar modification needed
    - Line 298: The gate to remove
    - Lines 310-322: The conditional save logic
  - `src/services/indexedDbService.ts:90-102` — `saveItemsToIdb` — the IDB-only save path for disconnected state
  - `src/services/indexedDbService.ts:47-53` — `saveQuickMemoToIdb` — IDB-only memo save

  **API/Type References**:
  - `src/store/syncStateStore.ts:markItemsDirty` — Action to call when saving dirty items (Task 2)
  - `src/store/syncStateStore.ts:markMemoDirty` — Action to call when saving dirty memo
  - `src/store/syncStateStore.ts:isSyncing` — Flag to check before saving

  **Acceptance Criteria**:
  - [ ] Items save effect no longer returns early when `isConnectedDb === false` (for logged-in users)
  - [ ] Memo save effect no longer returns early when `isConnectedDb === false`
  - [ ] When disconnected: items save to IDB only (no Firebase call attempted)
  - [ ] When disconnected: memo saves to IDB only
  - [ ] When connected: existing save behavior preserved (Firebase + IDB + timestamp)
  - [ ] `markItemsDirty` called when saving while disconnected
  - [ ] `markMemoDirty` called when saving while disconnected
  - [ ] Save effects skip execution when `isSyncing === true`
  - [ ] TypeScript compiles with no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify modified useObserve compiles
    Tool: Bash
    Preconditions: Tasks 1, 2 complete
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: No TypeScript errors
    Expected Result: Clean build
    Evidence: Terminal output

  Scenario: Verify save effect runs when disconnected
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in
    Steps:
      1. Navigate to app, select a tree
      2. Disconnect network (Chrome DevTools > Network > Offline)
      3. Edit a tree item text
      4. Wait 6 seconds (debounce is 5s)
      5. Check IDB via DevTools Application tab → IndexedDB → taskTreesDatabase → treestate
      6. Assert: IDB treestate record has updated items matching the edit
      7. Screenshot: .sisyphus/evidence/task-5-idb-save-while-offline.png
    Expected Result: Edit persisted to IDB despite being disconnected
    Evidence: .sisyphus/evidence/task-5-idb-save-while-offline.png
  ```

  **Commit**: YES
  - Message: `feat(sync): allow IDB saves while disconnected, track dirty state`
  - Files: `src/hooks/useObserve.ts`

---

- [ ] 6. Rewrite Firebase onValue listener with decision algorithm

  **What to do**:
  This is the **core task** of Phase 1. Rewrite the Firebase `onValue` timestamp listener in `useObserve.ts` (lines 117-167) to implement the decision algorithm.

  - **Current behavior** (to replace): When `serverTs > localTs`, unconditionally reload everything from Firebase and overwrite local state.
  
  - **New behavior**:
    ```
    onValue(timestampRef, async (snapshot) => {
      const serverTimestamp = snapshot.val();
      const currentLocalTimestamp = localTimestamp;
      
      if (!serverTimestamp || serverTimestamp <= currentLocalTimestamp) {
        return; // No update needed
      }

      // Step 1: Own-echo detection
      const remoteClientId = await loadLastWriteClientIdFromDb(uid);
      const localClientId = getClientId();
      
      if (remoteClientId === localClientId) {
        // This is our own write echoing back — just update local timestamp
        setLocalTimestamp(serverTimestamp);
        return;
      }

      // Step 2: It's a remote change. Apply decision algorithm.
      setIsSyncing(true);
      
      try {
        // For items (if a tree is loaded):
        const { dirty: itemsDirty, baseHash: itemsBaseHash } = useSyncStateStore.getState().itemsSync;
        
        if (!itemsDirty) {
          // No local edits — safe to apply server data
          // (This handles A1/B4 no-op via hash check, and A3/B3 apply server)
          // Proceed with existing reload logic (load from Firebase → IDB → local state)
          await reloadFromServer(uid, serverTimestamp); // extract existing logic into helper
        } else {
          // Local edits exist
          // Load server items and compute hash
          const serverItems = await dbService.loadItemsFromDb(currentTree);
          const serverItemsHash = hashData(serverItems);
          
          if (serverItemsHash === itemsBaseHash) {
            // Server unchanged since we started editing → push local (A2/B1)
            await pushLocalToServer();
          } else {
            const localItemsHash = hashData(items);
            if (serverItemsHash === localItemsHash) {
              // Convergence — server has same data as local
              clearItemsDirty();
              setLocalTimestamp(serverTimestamp);
            } else {
              // CONFLICT: server changed AND local changed differently
              // Phase 1: keep local, show warning, defer to Phase 2
              console.warn('Sync conflict detected — keeping local edits (Phase 2 will add merge)');
              // Set a flag that OfflineBanner can read to show conflict warning
              setLocalTimestamp(serverTimestamp);
              // Do NOT overwrite local data
            }
          }
        }
        
        // Same logic for memo (simpler since it's a single string)
        // ...
        
      } finally {
        setIsSyncing(false);
      }
    });
    ```
  
  - Extract the existing reload logic (lines 122-164) into a helper function `reloadFromServer(uid, serverTimestamp)` to keep it reusable
  - The `pushLocalToServer()` helper should:
    1. Call `saveItems(currentItems, currentTree)` — this writes to Firebase + IDB + updates timestamp
    2. Call `clearItemsDirty()` 
    3. The timestamp update from saveItems will trigger another onValue — but own-echo detection will catch it
  - Apply the same pattern for memo sync (check memoSync dirty/hash, decide action)
  - **Important**: The connection state observer (lines 170-180) must NOT set `isLoading=true` when disconnected anymore — remove those lines (Task 8 handles the banner). Instead:
    - Keep `setIsConnectedDb(snap.val() === true)` 
    - Remove the `isLoading` manipulation from the connection observer entirely

  **Must NOT do**:
  - Do NOT implement 3-way merge — just keep local and warn on true conflict
  - Do NOT show a dialog/modal for conflicts — just a banner
  - Do NOT change how `updateTimeStamp` notifies other members
  - Do NOT modify the initial startup sequence (IDB load → setIsLoading(false) → Firebase listener)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: This is the most complex task — rewriting core sync logic with multiple code paths, race conditions to handle, and must preserve existing behavior for the common case
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Tasks 1, 2, 4, 5)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 2, 4, 5, 7

  **References**:

  **Pattern References**:
  - `src/hooks/useObserve.ts:104-204` — The ENTIRE `observeTimeStamp` function — this is what's being rewritten. Study every line carefully:
    - Lines 106-113: Startup sequence (KEEP AS IS)
    - Lines 116-167: Firebase onValue listener (REWRITE)
    - Lines 117-119: Timestamp check (KEEP, modify)
    - Lines 122-164: Reload from server logic (EXTRACT to helper)
    - Lines 170-180: Connection observer (MODIFY — remove isLoading manipulation)
    - Lines 182-185: Cleanup returns (KEEP)
  - `src/hooks/useObserve.ts:39-81` — `saveImmediately` function — must also respect `isSyncing` flag and connection state
  - `src/hooks/useSync.ts:18-40` — `updateTimeStamp` — called by `saveItems`, will trigger own onValue echo

  **API/Type References**:
  - `src/utils/syncUtils.ts:getClientId, hashData` — For own-echo detection and hash comparison
  - `src/services/databaseService.ts:loadLastWriteClientIdFromDb` — To read remote clientId (Task 4)
  - `src/store/syncStateStore.ts` — All sync state actions and reads
  - `src/services/databaseService.ts:loadItemsFromDb` — To load server items for hash comparison
  - `src/services/databaseService.ts:loadQuickMemoFromDb` — To load server memo for hash comparison

  **Acceptance Criteria**:
  - [ ] Own writes (matching clientId) don't trigger a reload — just update timestamp
  - [ ] Remote changes with no local edits: server data applied as before
  - [ ] Remote changes with local dirty + server unchanged since edit start: local pushes silently
  - [ ] Remote changes with both sides changed: local data kept, console warning logged
  - [ ] Connection observer no longer sets `isLoading=true` on disconnection
  - [ ] `isSyncing` flag set to true during decision algorithm execution
  - [ ] Existing startup sequence (IDB load → Firebase listener) unchanged
  - [ ] TypeScript compiles with no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Own-echo detection — own write doesn't trigger reload
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in with a tree open
    Steps:
      1. Navigate to app, open a tree
      2. Add console.log spy on the reloadFromServer path
      3. Edit a tree item and wait for debounced save (5s+)
      4. Assert: Firebase write completes (check Network tab)
      5. Assert: reloadFromServer was NOT called (console log check)
      6. Assert: Tree content reflects the edit, not a reload
      7. Screenshot: .sisyphus/evidence/task-6-own-echo.png
    Expected Result: Edit saves without triggering a full reload
    Evidence: .sisyphus/evidence/task-6-own-echo.png

  Scenario: Disconnected edit + reconnect with unchanged server → silent push
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in, tree open
    Steps:
      1. Note the current tree content
      2. Go offline (Chrome DevTools Network > Offline)
      3. Edit a tree item
      4. Wait 6s for IDB save
      5. Go back online
      6. Wait for sync (observe console/network for Firebase write)
      7. Assert: Firebase now has the edited content
      8. Assert: No reload/flash of old content
      9. Screenshot: .sisyphus/evidence/task-6-silent-push.png
    Expected Result: Local edit silently pushed to Firebase
    Evidence: .sisyphus/evidence/task-6-silent-push.png

  Scenario: Server changed while user was offline with no local edits
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in, tree open
    Steps:
      1. Go offline
      2. Do NOT edit anything
      3. Manually write a change to Firebase via admin SDK or another browser tab
      4. Go back online
      5. Assert: Tree content updates to reflect server change
      6. Screenshot: .sisyphus/evidence/task-6-server-apply.png
    Expected Result: Server data applied as before
    Evidence: .sisyphus/evidence/task-6-server-apply.png
  ```

  **Commit**: YES
  - Message: `feat(sync): rewrite Firebase listener with decision algorithm and own-echo detection`
  - Files: `src/hooks/useObserve.ts`

---

- [ ] 7. Update saveItems/saveQuickMemo to update sync metadata on successful save

  **What to do**:
  - Modify `src/hooks/useTreeManagement.ts` `saveItems()` function:
    - After successful Firebase + IDB save (line 61-63), update sync metadata:
      ```typescript
      // After successful save
      const newHash = hashData(newItems);
      useSyncStateStore.getState().setItemsServerHash(newHash);
      useSyncStateStore.getState().clearItemsDirty();
      ```
    - This ensures that after a successful online save, the lastServerHash matches what we just wrote
  - Modify `src/hooks/useAppStateManagement.ts` `saveQuickMemo()` function:
    - After successful save (line 110-112):
      ```typescript
      const newHash = hashData(quickMemoText);
      useSyncStateStore.getState().setMemoServerHash(newHash);
      useSyncStateStore.getState().clearMemoDirty();
      ```
  - Also update `loadAndSetCurrentTreeDataFromIdb()` in useTreeManagement.ts:
    - After loading items from IDB and setting them in state (line 144), set the initial server hash:
      ```typescript
      const initialHash = hashData(treeData.items);
      useSyncStateStore.getState().setItemsBaseFromServer(treeData.items, initialHash);
      ```
    - This establishes the baseline hash when switching trees
  - Also update `loadAndSetQuickMemoFromDb` and `loadAndSetQuickMemoFromIdb` in useAppStateManagement.ts:
    - After setting memo text, set initial server hash for memo

  **Must NOT do**:
  - Do NOT modify the `handleSaveTreesList` or other tree list operations — Phase 1 tracks items and memo only
  - Do NOT change the save logic itself — just add metadata updates after successful save
  - Do NOT call sync metadata updates if the save throws an error

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Surgical additions to existing functions — add lines after successful saves
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1, 2)
  - **Parallel Group**: Wave 2a (with Tasks 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2 (needs syncUtils and syncStateStore)

  **References**:

  **Pattern References**:
  - `src/hooks/useTreeManagement.ts:42-67` — `saveItems` function — add sync metadata update after line 63 (after `updateTimeStamp`)
  - `src/hooks/useTreeManagement.ts:121-151` — `loadAndSetCurrentTreeDataFromIdb` — add initial hash computation after line 144 (after `setItems`)
  - `src/hooks/useAppStateManagement.ts:104-116` — `saveQuickMemo` — add sync metadata update after line 112 (after `updateTimeStamp`)
  - `src/hooks/useAppStateManagement.ts:42-60` — `loadAndSetQuickMemoFromDb` — add initial hash after line 56 (after `setQuickMemoText`)
  - `src/hooks/useAppStateManagement.ts:63-73` — `loadAndSetQuickMemoFromIdb` — add initial hash after line 68

  **API/Type References**:
  - `src/utils/syncUtils.ts:hashData` — Hash function to import
  - `src/store/syncStateStore.ts:useSyncStateStore` — Store to import for all sync metadata actions

  **Acceptance Criteria**:
  - [ ] After `saveItems` succeeds: `clearItemsDirty()` called and `lastServerHash` updated
  - [ ] After `saveQuickMemo` succeeds: `clearMemoDirty()` called and `lastServerHash` updated
  - [ ] After `loadAndSetCurrentTreeDataFromIdb`: `setItemsBaseFromServer` called with loaded items hash
  - [ ] After `loadAndSetQuickMemoFromDb/Idb`: memo server hash initialized
  - [ ] Sync metadata NOT updated if save throws an error
  - [ ] TypeScript compiles with no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify modified hooks compile
    Tool: Bash
    Preconditions: Tasks 1, 2 complete
    Steps:
      1. Run: npx tsc --noEmit
      2. Assert: No TypeScript errors
    Expected Result: Clean build
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat(sync): update save and load functions to track sync metadata`
  - Files: `src/hooks/useTreeManagement.ts`, `src/hooks/useAppStateManagement.ts`

---

- [ ] 8. Replace blocking spinner with OfflineBanner for disconnection

  **What to do**:
  - Modify `src/features/homepage/HomePage.tsx`:
    - Import `OfflineBanner` from `src/components/OfflineBanner.tsx`
    - Add `<OfflineBanner />` component in the JSX — place it inside the main content area, above the tree content
    - The existing `CircularProgress` (lines 115-132) should REMAIN for actual loading operations (data fetch, tree switch, etc.)
    - The change is that disconnection no longer triggers `isLoading=true` (that's handled in Task 6 by removing the isLoading manipulation from the connection observer)
  - Modify `src/hooks/useObserve.ts` connection observer (if not already done in Task 6):
    - Remove the lines that set `isLoading` based on connection state:
      ```typescript
      // REMOVE these lines from the connection observer:
      // if (snap.val() === true && isLoading) {
      //   setIsLoading(false);
      // } else if (snap.val() === false && !isLoading) {
      //   setIsLoading(true);
      // }
      ```
    - Keep ONLY: `setIsConnectedDb(snap.val() === true);`
  - Also update `saveImmediately` in useObserve.ts to handle the disconnected state:
    - When disconnected (`!isConnectedDb`), save to IDB only (similar to what Task 5 does for debounced saves)
    - Currently it checks `isOffline` for Capacitor Preferences path, and `uid` for the Firebase path. Add a third branch: `!isConnectedDb` → save to IDB only

  **Must NOT do**:
  - Do NOT remove the CircularProgress component entirely — it's still used for actual data loading
  - Do NOT make the offline banner cover/overlap the existing UI in a blocking way
  - Do NOT change the z-index of the spinner

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI changes — placing banner component, adjusting layout
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4-7 once Task 3 is done)
  - **Parallel Group**: Wave 2b (can start as soon as Task 3 completes)
  - **Blocks**: Task 9
  - **Blocked By**: Task 3, and partially Task 6 (connection observer change)

  **References**:

  **Pattern References**:
  - `src/features/homepage/HomePage.tsx:115-132` — Existing spinner location — place OfflineBanner nearby but separate
  - `src/features/homepage/HomePage.tsx:23` — `isLoading` subscription — do NOT remove, still needed for real loading
  - `src/hooks/useObserve.ts:170-180` — Connection observer to modify (remove isLoading manipulation)
  - `src/hooks/useObserve.ts:39-81` — `saveImmediately` to update with disconnected-save path

  **API/Type References**:
  - `src/components/OfflineBanner.tsx` — Component created in Task 3

  **Acceptance Criteria**:
  - [ ] OfflineBanner renders in HomePage when disconnected
  - [ ] CircularProgress still shows for actual loading operations (tree switch, data fetch)
  - [ ] Disconnecting does NOT show the spinner anymore
  - [ ] Reconnecting hides the OfflineBanner
  - [ ] `saveImmediately` saves to IDB when disconnected (not Firebase)
  - [ ] TypeScript compiles with no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Disconnection shows banner, not spinner
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in
    Steps:
      1. Navigate to app, open a tree
      2. Go offline (Chrome DevTools > Network > Offline)
      3. Wait 2 seconds
      4. Assert: "オフライン" banner visible
      5. Assert: CircularProgress NOT visible (no spinner)
      6. Assert: Tree content still editable (click an item, type text)
      7. Screenshot: .sisyphus/evidence/task-8-offline-banner-no-spinner.png
    Expected Result: Banner shows instead of spinner, app is fully interactive
    Evidence: .sisyphus/evidence/task-8-offline-banner-no-spinner.png

  Scenario: Reconnection hides banner
    Tool: Playwright (playwright skill)
    Preconditions: Previous scenario state (offline with banner showing)
    Steps:
      1. Go back online (Chrome DevTools > Network > Online)
      2. Wait 3 seconds for Firebase reconnection
      3. Assert: "オフライン" banner disappears
      4. Assert: No spinner (unless actual sync is loading)
      5. Screenshot: .sisyphus/evidence/task-8-reconnect-no-banner.png
    Expected Result: Banner gone, app back to normal
    Evidence: .sisyphus/evidence/task-8-reconnect-no-banner.png
  ```

  **Commit**: YES
  - Message: `feat(ui): replace blocking spinner with offline banner for disconnection`
  - Files: `src/features/homepage/HomePage.tsx`, `src/hooks/useObserve.ts`

---

- [ ] 9. End-to-end integration verification and edge case hardening

  **What to do**:
  - This task verifies the full integration of Tasks 1-8 working together
  - Run the full application and verify all sync scenarios end-to-end
  - Fix any issues found during integration testing
  - Specific edge cases to verify and fix if broken:
    1. **Tree switch while dirty**: When user switches trees, `prevItems` save logic (useObserve.ts:232-242) must still work. Verify that switching trees clears sync metadata via `resetAllSync()` (or at least resets items sync)
    2. **Rapid connect/disconnect**: If connection drops and restores multiple times quickly, ensure no race conditions with `isSyncing` flag
    3. **Tab visibility + offline**: `saveImmediately` (visibilitychange) while disconnected should save to IDB only
    4. **Empty items**: Hash of empty array `[]` should be handled correctly
    5. **First load (no server data)**: If server has no data yet, hashes should be initialized properly
    6. **Memo empty string**: When quickMemoText is empty string, don't create false dirty state
  - Add `resetAllSync()` call in appropriate places:
    - When `currentTree` changes (in the items save effect where `currentTree !== prevCurrentTree`)
    - On logout (wherever the logout flow clears state)

  **Must NOT do**:
  - Do NOT add new features beyond Phase 1 scope
  - Do NOT refactor working code just for aesthetics
  - Do NOT add error handling that changes UX beyond what's specified

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration testing requires understanding the full system, running multiple scenarios, and fixing subtle interaction bugs
  - **Skills**: [`playwright`, `git-master`]
    - `playwright`: For browser-based E2E verification scenarios
    - `git-master`: For final integration commit

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final, sequential)
  - **Blocks**: None (final task)
  - **Blocked By**: All previous tasks (1-8)

  **References**:

  **Pattern References**:
  - All files modified in Tasks 1-8
  - `src/hooks/useObserve.ts:232-242` — Tree switch / prevItems logic
  - `src/hooks/useObserve.ts:84-101` — visibilitychange / beforeunload handlers

  **Acceptance Criteria**:
  - [ ] Full app starts without errors
  - [ ] Online editing works exactly as before (no regressions)
  - [ ] Offline editing → IDB save → reconnect → silent push: works end to end
  - [ ] Tree switch while disconnected: no crash, sync state resets properly
  - [ ] Multiple rapid connect/disconnect cycles: no race conditions
  - [ ] Own-echo: saving while connected doesn't cause double-reload
  - [ ] TypeScript compiles with no errors
  - [ ] No console errors during normal operation

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full happy-path offline editing flow
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in, tree with some items
    Steps:
      1. Navigate to app, select a tree, note content
      2. Go offline
      3. Assert: OfflineBanner appears within 3 seconds
      4. Edit 3 different tree items (add text, check done, etc.)
      5. Wait 6 seconds for debounced save
      6. Verify IDB has updated data (DevTools check)
      7. Go back online
      8. Wait 10 seconds for sync
      9. Assert: OfflineBanner disappears
      10. Open Firebase console or second browser to verify data was pushed
      11. Assert: Firebase has the edited content
      12. Screenshot: .sisyphus/evidence/task-9-full-flow.png
    Expected Result: Edits survive offline→online transition
    Evidence: .sisyphus/evidence/task-9-full-flow.png

  Scenario: No regression — online editing unchanged
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in, online
    Steps:
      1. Navigate to app, select a tree
      2. Edit an item, wait 6s
      3. Refresh the page
      4. Assert: Edit persisted (data reloaded from server)
      5. Assert: No OfflineBanner visible
      6. Assert: No extra console warnings
      7. Screenshot: .sisyphus/evidence/task-9-no-regression.png
    Expected Result: Online behavior identical to before changes
    Evidence: .sisyphus/evidence/task-9-no-regression.png

  Scenario: Tree switch while dirty + disconnected
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in, multiple trees
    Steps:
      1. Go offline
      2. Edit current tree items
      3. Switch to another tree
      4. Assert: No crash or error
      5. Assert: Previous tree items were saved to IDB
      6. Switch back to original tree
      7. Assert: Edits are preserved (loaded from IDB)
      8. Screenshot: .sisyphus/evidence/task-9-tree-switch-offline.png
    Expected Result: Tree switching works correctly while disconnected
    Evidence: .sisyphus/evidence/task-9-tree-switch-offline.png

  Scenario: Quick memo offline editing
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, user logged in
    Steps:
      1. Go offline
      2. Open quick memo
      3. Type some text
      4. Wait 4 seconds (debounce is 3s)
      5. Go back online
      6. Wait 10 seconds for sync
      7. Refresh the page
      8. Assert: Quick memo text preserved
      9. Screenshot: .sisyphus/evidence/task-9-memo-offline.png
    Expected Result: Memo edits survive offline→online
    Evidence: .sisyphus/evidence/task-9-memo-offline.png
  ```

  **Commit**: YES
  - Message: `fix(sync): integration fixes and edge case hardening for offline editing`
  - Files: Any files needing fixes found during integration

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat(sync): add sync utilities — stableStringify, cyrb53 hash, clientId` | `src/utils/syncUtils.ts` | `npx tsc --noEmit` |
| 2 | `feat(sync): add sync state store for dirty tracking and hash comparison` | `src/store/syncStateStore.ts` | `npx tsc --noEmit` |
| 3 | `feat(ui): add non-blocking OfflineBanner component` | `src/components/OfflineBanner.tsx` | `npx tsc --noEmit` |
| 4 | `feat(sync): tag Firebase writes with clientId for own-echo detection` | `src/services/databaseService.ts` | `npx tsc --noEmit` |
| 5 | `feat(sync): allow IDB saves while disconnected, track dirty state` | `src/hooks/useObserve.ts` | `npx tsc --noEmit` |
| 6 | `feat(sync): rewrite Firebase listener with decision algorithm` | `src/hooks/useObserve.ts` | `npx tsc --noEmit` |
| 7 | `feat(sync): update save/load functions to track sync metadata` | `useTreeManagement.ts`, `useAppStateManagement.ts` | `npx tsc --noEmit` |
| 8 | `feat(ui): replace blocking spinner with offline banner` | `HomePage.tsx`, `useObserve.ts` | `npx tsc --noEmit` |
| 9 | `fix(sync): integration fixes and edge case hardening` | Various | Full E2E scenarios |

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit  # Expected: no errors
npm run build      # Expected: successful production build
```

### Final Checklist
- [ ] All "Must Have" present (sync metadata, clientId, offline banner, IDB-only saves, decision algorithm)
- [ ] All "Must NOT Have" absent (no 3-way merge, no conflict UI, no multi-user handling, no schema changes)
- [ ] Online editing behavior unchanged (no regressions)
- [ ] Offline editing persists to IDB
- [ ] Reconnection syncs correctly for all Phase 1 scenarios
- [ ] Own-echo detection prevents redundant reloads
- [ ] OfflineBanner shows instead of spinner when disconnected
- [ ] All TypeScript compiles cleanly
- [ ] No console errors during normal operation
