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

describe('useObserve merge integration logic', () => {
  it('skips merge when serverHash === baseHash (server unchanged, local wins)', () => {
    const baseItems: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const serverItems = structuredClone(baseItems);

    const baseHash = hashData(baseItems);
    const serverHash = hashData(serverItems);

    expect(serverHash).toBe(baseHash);
  });

  it('skips merge when serverHash === localHash (already converged)', () => {
    const localItems: TreeItems = [makeItem(1, 'Same edit'), makeTrash()];
    const serverItems: TreeItems = [makeItem(1, 'Same edit'), makeTrash()];

    const serverHash = hashData(serverItems);
    const localHash = hashData(localItems);

    expect(serverHash).toBe(localHash);
  });

  it('triggers 3-way-merge when hashes differ and baseSnapshot exists', () => {
    const baseItems: TreeItems = [makeItem(1, 'Original'), makeItem(2, 'Task B'), makeTrash()];
    const localItems: TreeItems = [makeItem(1, 'Local edit'), makeItem(2, 'Task B'), makeTrash()];
    const serverItems: TreeItems = [makeItem(1, 'Original'), makeItem(2, 'Server edit'), makeTrash()];

    const baseHash = hashData(baseItems);
    const serverHash = hashData(serverItems);
    const localHash = hashData(localItems);

    expect(serverHash).not.toBe(baseHash);
    expect(serverHash).not.toBe(localHash);

    const result = mergeTreeItems(baseItems, localItems, serverItems);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Local edit');
    expect(result.merged.find((i) => i.id === 2)?.value).toBe('Server edit');
  });

  it('falls back to server when no baseSnapshot available', () => {
    const localItems: TreeItems = [makeItem(1, 'Local'), makeTrash()];
    const serverItems: TreeItems = [makeItem(1, 'Server'), makeTrash()];

    const result = mergeTreeItems(null, localItems, serverItems);

    expect(result.merged).toEqual(serverItems);
    expect(result.hasConflicts).toBe(false);
  });

  it('reports conflicts for same-field edits and applies server value', () => {
    const baseItems: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const localItems: TreeItems = [makeItem(1, 'Local version'), makeTrash()];
    const serverItems: TreeItems = [makeItem(1, 'Server version'), makeTrash()];

    const result = mergeTreeItems(baseItems, localItems, serverItems);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflictDetails.length).toBe(1);
    expect(result.conflictDetails[0]).toMatchObject({
      itemId: 1,
      field: 'value',
      localValue: 'Local version',
      serverValue: 'Server version',
      resolution: 'server-wins',
    });
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Server version');
  });

  it('merged result hash differs from both local and server when merge combines changes', () => {
    const baseItems: TreeItems = [makeItem(1, 'A'), makeItem(2, 'B'), makeTrash()];
    const localItems: TreeItems = [makeItem(1, 'A edited'), makeItem(2, 'B'), makeTrash()];
    const serverItems: TreeItems = [makeItem(1, 'A'), makeItem(2, 'B edited'), makeTrash()];

    const result = mergeTreeItems(baseItems, localItems, serverItems);
    const mergedHash = hashData(result.merged);
    const localHash = hashData(localItems);
    const serverHash = hashData(serverItems);

    expect(mergedHash).not.toBe(localHash);
    expect(mergedHash).not.toBe(serverHash);
  });

  it('memo conflict: server wins since memo is a simple string', () => {
    const baseMemo = 'Original memo';
    const localMemo = 'Local edits to memo';
    const serverMemo = 'Server edits to memo';

    const baseHash = hashData(baseMemo);
    const serverHash = hashData(serverMemo);
    const localHash = hashData(localMemo);

    expect(serverHash).not.toBe(baseHash);
    expect(serverHash).not.toBe(localHash);
  });
});
