import { describe, it, expect } from 'vitest';
import { mergeTreeItems } from '@/utils/mergeUtils';
import { hashData } from '@/utils/syncUtils';
import type { TreeItems } from '@/types/types';

function makeItem(id: string | number, value: string, children: TreeItems = []): TreeItems[0] {
  return { id, value, children };
}

function makeTrash(children: TreeItems = []): TreeItems[0] {
  return { id: 'trash', value: 'Trash', children };
}

type SyncState = {
  dirty: boolean;
  baseSnapshot: TreeItems | null;
  baseHash: string;
};

function simulateReconnectMerge(
  syncState: SyncState,
  localItems: TreeItems,
  serverItems: TreeItems | null,
  wasConnected: boolean,
  isNowConnected: boolean
): { shouldMerge: boolean; mergeResult?: ReturnType<typeof mergeTreeItems> } {
  if (wasConnected || !isNowConnected) {
    return { shouldMerge: false };
  }

  if (!syncState.dirty || !syncState.baseSnapshot || !serverItems) {
    return { shouldMerge: false };
  }

  const result = mergeTreeItems(syncState.baseSnapshot, localItems, serverItems);
  return { shouldMerge: true, mergeResult: result };
}

describe('offline reconnect sync', () => {
  it('triggers merge on reconnect when dirty items exist', () => {
    const base: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Edited offline'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Edited on another device'), makeTrash()];

    const syncState: SyncState = {
      dirty: true,
      baseSnapshot: base,
      baseHash: hashData(base),
    };

    const result = simulateReconnectMerge(syncState, local, server, false, true);

    expect(result.shouldMerge).toBe(true);
    expect(result.mergeResult).toBeDefined();
    expect(result.mergeResult!.merged.find((i) => i.id === 1)?.value).toBe('Edited on another device');
    expect(result.mergeResult!.hasConflicts).toBe(true);
  });

  it('does not merge when no dirty data', () => {
    const local: TreeItems = [makeItem(1, 'Clean'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Clean'), makeTrash()];

    const syncState: SyncState = {
      dirty: false,
      baseSnapshot: null,
      baseHash: '',
    };

    const result = simulateReconnectMerge(syncState, local, server, false, true);

    expect(result.shouldMerge).toBe(false);
  });

  it('does not merge when already connected (not a reconnect)', () => {
    const base: TreeItems = [makeItem(1, 'Base'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Modified'), makeTrash()];

    const syncState: SyncState = {
      dirty: true,
      baseSnapshot: base,
      baseHash: hashData(base),
    };

    const result = simulateReconnectMerge(syncState, local, base, true, true);

    expect(result.shouldMerge).toBe(false);
  });

  it('does not merge when disconnecting (not reconnecting)', () => {
    const base: TreeItems = [makeItem(1, 'Base'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Modified'), makeTrash()];

    const syncState: SyncState = {
      dirty: true,
      baseSnapshot: base,
      baseHash: hashData(base),
    };

    const result = simulateReconnectMerge(syncState, local, base, true, false);

    expect(result.shouldMerge).toBe(false);
  });

  it('merges different items silently on reconnect', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Task A edited'), makeItem(2, 'Task B'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B edited'), makeTrash()];

    const syncState: SyncState = {
      dirty: true,
      baseSnapshot: base,
      baseHash: hashData(base),
    };

    const result = simulateReconnectMerge(syncState, local, server, false, true);

    expect(result.shouldMerge).toBe(true);
    expect(result.mergeResult!.hasConflicts).toBe(false);
    expect(result.mergeResult!.merged.find((i) => i.id === 1)?.value).toBe('Task A edited');
    expect(result.mergeResult!.merged.find((i) => i.id === 2)?.value).toBe('Task B edited');
  });

  it('handles server returning null (tree deleted while offline)', () => {
    const base: TreeItems = [makeItem(1, 'Task'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Edited'), makeTrash()];

    const syncState: SyncState = {
      dirty: true,
      baseSnapshot: base,
      baseHash: hashData(base),
    };

    const result = simulateReconnectMerge(syncState, local, null, false, true);

    expect(result.shouldMerge).toBe(false);
  });
});
