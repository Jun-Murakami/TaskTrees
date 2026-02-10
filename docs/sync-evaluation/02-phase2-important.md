# Phase 2: Important — Permission Loss Detection & Offline Integration

> **Reference**: [00-evaluation-report.md](./00-evaluation-report.md)  
> **Gaps Addressed**: GAP-3 (edit permission loss), GAP-4 (offline integration)  
> **Priority**: Important  

---

## Task 2-1: Edit Permission Loss Detection + Auto Local Copy

### Gap: GAP-3
When a shared tree owner removes a member, the member's client has no way to detect this. They continue editing locally. Their next save attempt may fail silently or with an opaque Firebase permission error.

### Detection Strategy

#### Option A: Reactive Detection (Recommended)
Monitor the trees list update. When `loadAndSetTreesListFromDb` returns, check if any previously known shared trees are now missing from the list.

```typescript
// In onValue callback, after loadAndSetTreesListFromDb:
const previousTreesList = useTreeStateStore.getState().treesList;
const newTreesList = await loadAndSetTreesListFromDb({ saveToIdb: true });

// Find trees that disappeared (deleted or permission revoked)
const removedTreeIds = previousTreesList
  .filter(prev => !newTreesList.some(next => next.id === prev.id))
  .map(t => t.id);

for (const removedId of removedTreeIds) {
  if (removedId === currentTree) {
    // Currently editing this tree - handle like tree deletion
    // but with permission-specific messaging
    await handlePermissionLoss(removedId);
  }
}
```

#### UX Behavior
- **Auto-save local copy** of current items (no confirmation needed - data safety first)
- Show notification: "You no longer have access to '{treeName}'. A local copy has been saved."
- Navigate to the local copy

### Files Modified
- `src/hooks/useObserve.ts` — detection in `onValue` callback
- `src/hooks/useTreeManagement.ts` — `handlePermissionLoss` method
- `src/store/treeStateStore.ts` — track previous treesList for diffing

### Tests: `src/__tests__/unit/permissionLoss.test.ts`
1. Shared tree disappears from trees list -> local copy auto-saved
2. Notification shown with correct tree name
3. Navigation to local copy after save
4. Non-current tree removed -> no immediate action (just list updated)
5. Own tree deleted (not permission loss) -> handled by GAP-2 detection, not here
6. Multiple trees removed simultaneously -> each handled

---

## Task 2-2: Offline Integration Improvement

### Gap: GAP-4
When coming back online after offline editing, `checkAndSyncDb` runs but the merge is basic: if dirty + server changed, it falls into the `console.warn` path (which Phase 1 replaces with 3-way-merge). However, the offline->online transition should be smoother.

### Improvements

#### 1. Background Auto-Merge on Reconnect
When `isConnectedDb` transitions from `false` to `true`:
```typescript
// In connection state observer (useObserve.ts L243-246):
const prevConnected = useRef(false);

onValue(connectedRef, async (snap) => {
  const isNowConnected = snap.val() === true;
  setIsConnectedDb(isNowConnected);
  
  if (!prevConnected.current && isNowConnected) {
    // Just reconnected - trigger background sync
    await backgroundReconnectSync();
  }
  prevConnected.current = isNowConnected;
});
```

#### 2. `backgroundReconnectSync` Logic
```typescript
async function backgroundReconnectSync() {
  const { itemsSync, memoSync } = useSyncStateStore.getState();
  
  // Sync dirty items using 3-way-merge (from Phase 1)
  if (itemsSync.dirty && itemsSync.baseSnapshot) {
    const currentTree = useTreeStateStore.getState().currentTree;
    if (currentTree) {
      const serverItems = await dbService.loadItemsFromDb(currentTree);
      const localItems = useTreeStateStore.getState().items;
      const result = mergeTreeItems(itemsSync.baseSnapshot, localItems, serverItems);
      
      await dbService.saveItemsDb(currentTree, result.merged);
      await idbService.saveItemsToIdb(currentTree, result.merged);
      setItems(result.merged);
      useSyncStateStore.getState().clearItemsDirty();
      
      if (result.hasConflicts) {
        showSyncNotification('Offline changes merged. Some conflicts resolved automatically.');
      }
    }
  }
  
  // Sync dirty memo
  if (memoSync.dirty) {
    // Similar logic for memo
  }
  
  // Full timestamp sync to catch other changes
  await checkAndSyncDb();
}
```

#### 3. Connection Status UX
- Show subtle connection indicator (already exists via `isConnectedDb`)
- On reconnect: brief "Back online — syncing..." message
- After sync: "All changes synced" or "Changes merged" if conflicts existed

### Files Modified
- `src/hooks/useObserve.ts` — reconnect detection + background sync
- `src/hooks/useSync.ts` — `backgroundReconnectSync` method

### Tests: `src/__tests__/unit/offlineReconnect.test.ts`
1. Connection restored with dirty items -> merge triggered
2. Connection restored with no dirty data -> just timestamp sync
3. Connection restored with dirty memo -> memo synced
4. Merge conflict during reconnect -> resolved with 3-way-merge
5. Rapid reconnect cycles -> only one sync triggered (debounce)
6. Reconnect while user is actively editing -> doesn't interrupt
