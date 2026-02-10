# Phase 1: Critical — Task-level 3-Way-Merge & Tree Deletion Detection

> **Reference**: [00-evaluation-report.md](./00-evaluation-report.md)  
> **Gaps Addressed**: GAP-1 (3-way-merge), GAP-2 (tree deletion detection)  
> **Priority**: Critical  

---

## Task 1-1: Task-level 3-Way-Merge Utility

### File: `src/utils/mergeUtils.ts` (new)

### Algorithm
Given three versions of `TreeItems`:
- **base**: snapshot captured at `markItemsDirty` time (`syncStateStore.itemsSync.baseSnapshot`)
- **local**: current items in Zustand (`useTreeStateStore.getState().items`)
- **server**: fetched from Firebase in `onValue` callback

#### Step 1: Build ID-indexed maps
```typescript
type ItemMap = Map<UniqueIdentifier, { item: TreeItem; parentId: UniqueIdentifier | null; index: number }>
```
Flatten each version into `ItemMap` using existing `flattenTree` utility.

#### Step 2: Categorize changes per-item
For each item ID across all three maps:
- **Added locally**: exists in local, not in base
- **Added on server**: exists in server, not in base
- **Deleted locally**: exists in base, not in local
- **Deleted on server**: exists in base, not in server
- **Modified locally**: exists in base and local, fields differ
- **Modified on server**: exists in base and server, fields differ
- **Moved locally**: same item, different parentId/index
- **Moved on server**: same item, different parentId/index

#### Step 3: Merge strategy per category

| Local Change | Server Change | Resolution | UX |
|-------------|---------------|------------|-----|
| Add | — | Include local add | Silent |
| — | Add | Include server add | Silent |
| Delete | — | Accept local delete | Silent |
| — | Delete | Accept server delete | Silent |
| Modify field A | Modify field B | Merge both fields | Silent |
| Modify field A | Modify field A (same value) | Converged | Silent |
| Modify field A | Modify field A (different value) | **Conflict** | Last-write-wins (server) + keep local as "conflict copy" |
| Move | — | Accept local move | Silent |
| — | Move | Accept server move | Silent |
| Move | Move (same destination) | Converged | Silent |
| Move | Move (different destination) | Server wins | Silent |
| Delete | Modify | Restore item (server version) | Silent |
| Modify | Delete | Restore item (local version) | Silent |
| Add (same ID) | Add (same ID) | Merge fields | Silent |

#### Step 4: Rebuild tree structure
Use merged flat items to reconstruct `TreeItems` via `buildTree` utility.

#### Return type
```typescript
type MergeResult = {
  merged: TreeItems;           // The merged result
  hasConflicts: boolean;       // True if any true conflicts existed  
  conflictDetails: ConflictDetail[];  // Details for UX notification
  strategy: 'auto' | 'manual'; // 'auto' if all resolved silently
}

type ConflictDetail = {
  itemId: UniqueIdentifier;
  field: string;
  localValue: unknown;
  serverValue: unknown;
  resolution: 'server-wins' | 'local-wins' | 'merged';
}
```

### Tests: `src/__tests__/unit/mergeUtils.test.ts`
1. No changes (all identical) -> returns base unchanged
2. Local-only changes -> returns local
3. Server-only changes -> returns server
4. Both change different items -> merged silently
5. Both change different fields of same item -> merged silently
6. Both change same field to same value -> converged
7. Both change same field to different values -> server wins, conflict reported
8. Local deletes, server modifies -> restore (server version)
9. Server deletes, local modifies -> restore (local version)
10. Both add new items -> both included
11. Structural move conflicts -> server wins
12. Complex mixed scenario (add + delete + modify + move)

---

## Task 1-2: Integrate 3-Way-Merge into useObserve

### File: `src/hooks/useObserve.ts`

### Changes
Replace the two `console.warn` blocks (items L200-207 and memo L168-170) with actual merge logic.

#### Items merge (L200-207 replacement):
```typescript
// Current: console.warn('Items sync conflict detected...')
// New:
const baseItems = useSyncStateStore.getState().itemsSync.baseSnapshot;
if (baseItems) {
  const localItems = useTreeStateStore.getState().items;
  const result = mergeTreeItems(baseItems, localItems, serverItems);
  
  // Apply merged result
  setItems(result.merged);
  await dbService.saveItemsDb(treeId, result.merged);
  await idbService.saveItemsToIdb(treeId, result.merged);
  useSyncStateStore.getState().clearItemsDirty();
  useSyncStateStore.getState().setItemsServerHash(hashData(result.merged));
  
  if (result.hasConflicts) {
    // Show brief toast notification (not blocking dialog)
    showSyncNotification('Some edits were merged. Server version used for conflicting fields.');
  }
} else {
  // No base snapshot available — server wins (safe fallback)
  await copyTreeDataToIdbFromDb(treeId);
  const freshItems = await idbService.loadItemsFromIdb(treeId);
  if (freshItems) setItems(freshItems);
  useSyncStateStore.getState().clearItemsDirty();
}
```

#### Memo merge (L168-170 replacement):
Memo is a simple string — use text-level merge:
- If both changed, append server changes after local (or last-write-wins for simplicity)
- Memo conflicts are low-risk; server-wins with local backup notification

### Tests: `src/__tests__/unit/useObserveMerge.test.ts`
1. Items conflict triggers mergeTreeItems (mock)
2. Merged result is saved to DB + IDB + store
3. Conflict notification shown when hasConflicts=true
4. No notification when auto-merged silently
5. Fallback to server-wins when no base snapshot
6. Memo conflict resolution

---

## Task 1-3: Tree Deletion Detection + Local Copy Proposal

### Files Modified
- `src/hooks/useObserve.ts` — detection logic in `onValue` callback
- `src/hooks/useTreeManagement.ts` — `saveAsLocalCopy` new method
- Dialog triggered via existing `showDialog` from `useDialogStore`

### Detection Logic
In `onValue` callback (after `loadAndSetTreesListFromDb`), check:
```typescript
const currentTree = useTreeStateStore.getState().currentTree;
const treeStillExists = newTreesList.some(tree => tree.id === currentTree);

if (!treeStillExists && currentTree) {
  // Tree was deleted on server while user has it open
  const currentItems = useTreeStateStore.getState().items;
  const currentTreeName = useTreeStateStore.getState().currentTreeName;
  
  if (currentItems.length > 0) {
    // Offer to save as new tree
    const shouldSave = await showDialog(
      `"${currentTreeName}" has been deleted on another device. Save a local copy?`,
      'Tree Deleted',
      { confirmText: 'Save Copy', cancelText: 'Discard' }
    );
    
    if (shouldSave) {
      await saveAsLocalCopy(currentItems, `${currentTreeName} (Copy)`);
    }
  }
  
  // Navigate to first available tree or empty state
  navigateToFirstTree(newTreesList);
}
```

### `saveAsLocalCopy` method
Creates a new tree with the given items, adds to trees list, saves to DB + IDB.

### Tests: `src/__tests__/unit/treeDeletion.test.ts`
1. Tree deleted on server -> dialog shown
2. User chooses "Save Copy" -> new tree created with items
3. User chooses "Discard" -> navigates away, no data saved
4. Tree deleted but items are empty -> no dialog, just navigate away
5. Tree not deleted -> no detection triggered
6. Shared tree deleted by owner -> same behavior
