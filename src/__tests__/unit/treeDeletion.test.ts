import { describe, it, expect } from 'vitest';
import type { TreesList, TreeItems } from '@/types/types';

function makeItem(id: string | number, value: string, children: TreeItems = []): TreeItems[0] {
  return { id, value, children };
}

function makeTrash(children: TreeItems = []): TreeItems[0] {
  return { id: 'trash', value: 'Trash', children };
}

function detectTreeDeletion(
  currentTree: string | null,
  newTreesList: TreesList,
  currentItems: TreeItems
): { deleted: boolean; hasUnsavedData: boolean } {
  if (!currentTree) {
    return { deleted: false, hasUnsavedData: false };
  }
  const treeStillExists = newTreesList.some((t) => t.id === currentTree);
  if (treeStillExists) {
    return { deleted: false, hasUnsavedData: false };
  }
  return { deleted: true, hasUnsavedData: currentItems.length > 0 };
}

describe('tree deletion detection', () => {
  it('detects when current tree is removed from server trees list', () => {
    const currentTree = 'tree-1';
    const newTreesList: TreesList = [{ id: 'tree-2', name: 'Other Tree' }];
    const currentItems: TreeItems = [makeItem(1, 'Task'), makeTrash()];

    const result = detectTreeDeletion(currentTree, newTreesList, currentItems);

    expect(result.deleted).toBe(true);
    expect(result.hasUnsavedData).toBe(true);
  });

  it('does not trigger when current tree still exists in list', () => {
    const currentTree = 'tree-1';
    const newTreesList: TreesList = [
      { id: 'tree-1', name: 'My Tree' },
      { id: 'tree-2', name: 'Other Tree' },
    ];
    const currentItems: TreeItems = [makeItem(1, 'Task'), makeTrash()];

    const result = detectTreeDeletion(currentTree, newTreesList, currentItems);

    expect(result.deleted).toBe(false);
  });

  it('detects deletion but reports no unsaved data when items are empty', () => {
    const currentTree = 'tree-1';
    const newTreesList: TreesList = [{ id: 'tree-2', name: 'Other' }];
    const currentItems: TreeItems = [];

    const result = detectTreeDeletion(currentTree, newTreesList, currentItems);

    expect(result.deleted).toBe(true);
    expect(result.hasUnsavedData).toBe(false);
  });

  it('handles null currentTree gracefully', () => {
    const newTreesList: TreesList = [{ id: 'tree-1', name: 'Tree' }];
    const currentItems: TreeItems = [];

    const result = detectTreeDeletion(null, newTreesList, currentItems);

    expect(result.deleted).toBe(false);
  });

  it('detects deletion when all trees are removed', () => {
    const currentTree = 'tree-1';
    const newTreesList: TreesList = [];
    const currentItems: TreeItems = [makeItem(1, 'Important task'), makeTrash()];

    const result = detectTreeDeletion(currentTree, newTreesList, currentItems);

    expect(result.deleted).toBe(true);
    expect(result.hasUnsavedData).toBe(true);
  });

  it('handles shared tree deletion by owner (same detection pattern)', () => {
    const currentTree = 'shared-tree-abc';
    const newTreesList: TreesList = [
      { id: 'my-tree-1', name: 'My Tree' },
    ];
    const currentItems: TreeItems = [
      makeItem(1, 'Shared task editing'),
      makeItem(2, 'Another shared task'),
      makeTrash(),
    ];

    const result = detectTreeDeletion(currentTree, newTreesList, currentItems);

    expect(result.deleted).toBe(true);
    expect(result.hasUnsavedData).toBe(true);
  });
});
