import { describe, it, expect } from 'vitest';
import { buildTreesListAfterAdd } from '@/utils/treesListMerge';
import { TreesList } from '@/types/types';

/**
 * Reproduces the "create a tree during the first sync wipes every other
 * device's trees" data-loss bug.
 *
 *  1. A fresh install signs in. The initial sync (`syncDb`) is still running,
 *     so the in-memory `treesList` store is still empty — the authoritative
 *     `users/{uid}/treeList` (which already lists trees A and B created on
 *     other devices) has not been loaded into the store yet.
 *  2. The user creates a new tree C and edits it.
 *  3. `handleCreateNewTree` builds the next trees-list by appending C to the
 *     (empty) in-memory list and writes it back to the server, which persists
 *     the whole array with `set()`.
 *  4. `users/{uid}/treeList` is now just [C]. Trees A and B are unreachable;
 *     after the next sync they disappear on every device.
 *
 * The correct behaviour is additive: adding C must preserve A and B. The merge
 * therefore has to be based on the authoritative server list, not the stale
 * in-memory one.
 */
describe('buildTreesListAfterAdd — additive create/import during initial sync', () => {
  const A = { id: 'treeA', name: 'Tree A' };
  const B = { id: 'treeB', name: 'Tree B' };
  const C = { id: 'treeC', name: '新しいツリー' };

  it('keeps the existing server trees when adding a tree while the local list is still empty', () => {
    const serverList: TreesList = [A, B]; // other devices' trees, authoritative
    const localList: TreesList = []; // store not yet populated during first sync
    const result = buildTreesListAfterAdd(serverList, localList, [C]);

    const ids = result.map((t) => String(t.id));
    expect(ids).toContain('treeA');
    expect(ids).toContain('treeB');
    expect(ids).toContain('treeC');
    expect(result).toHaveLength(3);
  });

  it('preserves server order, then appends the new tree last', () => {
    const result = buildTreesListAfterAdd([A, B], [], [C]);
    expect(result.map((t) => String(t.id))).toEqual(['treeA', 'treeB', 'treeC']);
  });

  it('does not duplicate a tree already present on the server and locally', () => {
    // The local store has caught up to the server (both know A) and we add C.
    const result = buildTreesListAfterAdd([A], [A], [C]);
    expect(result.map((t) => String(t.id))).toEqual(['treeA', 'treeC']);
  });

  it('keeps local-only entries that the server has not yet stored', () => {
    // A exists on the server; B was just created locally and is mid-flight.
    const result = buildTreesListAfterAdd([A], [A, B], [C]);
    expect(result.map((t) => String(t.id))).toEqual(['treeA', 'treeB', 'treeC']);
  });

  it('supports importing several trees at once without dropping server trees', () => {
    const D = { id: 'treeD', name: 'Imported D' };
    const E = { id: 'treeE', name: 'Imported E' };
    const result = buildTreesListAfterAdd([A, B], [], [D, E]);
    expect(result.map((t) => String(t.id))).toEqual([
      'treeA',
      'treeB',
      'treeD',
      'treeE',
    ]);
  });
});
