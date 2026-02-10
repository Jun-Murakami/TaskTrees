import { describe, it, expect } from 'vitest';
import { mergeTreeItems } from '@/utils/mergeUtils';
import type { TreeItems } from '@/types/types';

function makeItem(id: string | number, value: string, children: TreeItems = []): TreeItems[0] {
  return { id, value, children };
}

function makeTrash(children: TreeItems = []): TreeItems[0] {
  return { id: 'trash', value: 'Trash', children };
}

describe('mergeTreeItems', () => {
  it('returns base unchanged when all three are identical', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local = structuredClone(base);
    const server = structuredClone(base);

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.conflictDetails).toEqual([]);
    expect(result.strategy).toBe('auto');
    expect(result.merged.length).toBe(3);
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Task A');
    expect(result.merged.find((i) => i.id === 2)?.value).toBe('Task B');
  });

  it('returns local version when only local changed', () => {
    const base: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Edited locally'), makeTrash()];
    const server = structuredClone(base);

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Edited locally');
  });

  it('returns server version when only server changed', () => {
    const base: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const local = structuredClone(base);
    const server: TreeItems = [makeItem(1, 'Edited on server'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Edited on server');
  });

  it('merges silently when both change different items', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Task A edited'), makeItem(2, 'Task B'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B edited'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Task A edited');
    expect(result.merged.find((i) => i.id === 2)?.value).toBe('Task B edited');
  });

  it('merges silently when both change different fields of the same item', () => {
    const base: TreeItems = [{ id: 1, value: 'Task', children: [], done: false, collapsed: false }];
    const local: TreeItems = [{ id: 1, value: 'Task renamed', children: [], done: false, collapsed: false }];
    const server: TreeItems = [{ id: 1, value: 'Task', children: [], done: true, collapsed: false }];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    const merged = result.merged.find((i) => i.id === 1);
    expect(merged?.value).toBe('Task renamed');
    expect(merged?.done).toBe(true);
  });

  it('converges when both change same field to same value', () => {
    const base: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Same edit'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Same edit'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Same edit');
  });

  it('reports conflict when both change same field to different values (server wins)', () => {
    const base: TreeItems = [makeItem(1, 'Original'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Local edit'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Server edit'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(true);
    expect(result.conflictDetails.length).toBe(1);
    expect(result.conflictDetails[0].itemId).toBe(1);
    expect(result.conflictDetails[0].field).toBe('value');
    expect(result.conflictDetails[0].localValue).toBe('Local edit');
    expect(result.conflictDetails[0].serverValue).toBe('Server edit');
    expect(result.conflictDetails[0].resolution).toBe('server-wins');
    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Server edit');
  });

  it('restores server version when local deletes but server modifies', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local: TreeItems = [makeItem(2, 'Task B'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Task A modified'), makeItem(2, 'Task B'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    const restoredItem = result.merged.find((i) => i.id === 1);
    expect(restoredItem).toBeDefined();
    expect(restoredItem?.value).toBe('Task A modified');
  });

  it('restores local version when server deletes but local modifies', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Task A modified'), makeItem(2, 'Task B'), makeTrash()];
    const server: TreeItems = [makeItem(2, 'Task B'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    const restoredItem = result.merged.find((i) => i.id === 1);
    expect(restoredItem).toBeDefined();
    expect(restoredItem?.value).toBe('Task A modified');
  });

  it('includes items added on both sides', () => {
    const base: TreeItems = [makeItem(1, 'Existing'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Existing'), makeItem(2, 'Added locally'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Existing'), makeItem(3, 'Added on server'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 1)).toBeDefined();
    expect(result.merged.find((i) => i.id === 2)?.value).toBe('Added locally');
    expect(result.merged.find((i) => i.id === 3)?.value).toBe('Added on server');
    expect(result.merged.find((i) => i.id === 'trash')).toBeDefined();
  });

  it('uses server position when both move same item to different parents', () => {
    const base: TreeItems = [
      { id: 1, value: 'Parent A', children: [makeItem(3, 'Child')] },
      makeItem(2, 'Parent B'),
      makeTrash(),
    ];
    const local: TreeItems = [
      makeItem(1, 'Parent A'),
      { id: 2, value: 'Parent B', children: [makeItem(3, 'Child')] },
      makeTrash(),
    ];
    const server: TreeItems = [
      makeItem(1, 'Parent A'),
      makeItem(2, 'Parent B'),
      { id: 'trash', value: 'Trash', children: [makeItem(3, 'Child')] },
    ];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    const trashItem = result.merged.find((i) => i.id === 'trash');
    expect(trashItem?.children.some((c) => c.id === 3)).toBe(true);
  });

  it('handles complex mixed scenarios (add + delete + modify)', () => {
    const base: TreeItems = [
      makeItem(1, 'Keep'),
      makeItem(2, 'Will be deleted locally'),
      makeItem(3, 'Will be modified on server'),
      makeItem(4, 'Modified on both differently'),
      makeTrash(),
    ];
    const local: TreeItems = [
      makeItem(1, 'Keep'),
      makeItem(3, 'Will be modified on server'),
      makeItem(4, 'Local version'),
      makeItem(5, 'New local item'),
      makeTrash(),
    ];
    const server: TreeItems = [
      makeItem(1, 'Keep'),
      makeItem(2, 'Will be deleted locally'),
      makeItem(3, 'Server modified'),
      makeItem(4, 'Server version'),
      makeItem(6, 'New server item'),
      makeTrash(),
    ];

    const result = mergeTreeItems(base, local, server);

    expect(result.merged.find((i) => i.id === 1)?.value).toBe('Keep');
    expect(result.merged.find((i) => i.id === 2)).toBeUndefined();
    expect(result.merged.find((i) => i.id === 3)?.value).toBe('Server modified');
    expect(result.merged.find((i) => i.id === 4)?.value).toBe('Server version');
    expect(result.merged.find((i) => i.id === 5)?.value).toBe('New local item');
    expect(result.merged.find((i) => i.id === 6)?.value).toBe('New server item');
    expect(result.merged.find((i) => i.id === 'trash')).toBeDefined();

    expect(result.hasConflicts).toBe(true);
    expect(result.conflictDetails.some((c) => c.itemId === 4 && c.field === 'value')).toBe(true);
  });

  it('falls back to server when base is null', () => {
    const server: TreeItems = [makeItem(1, 'Server data'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Local data'), makeTrash()];

    const result = mergeTreeItems(null, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toEqual(server);
  });

  it('falls back to server when base is empty', () => {
    const server: TreeItems = [makeItem(1, 'Server data'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Local data'), makeTrash()];

    const result = mergeTreeItems([], local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged).toEqual(server);
  });

  it('preserves trash item in all scenarios', () => {
    const base: TreeItems = [makeItem(1, 'Task'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Task edited'), makeTrash()];
    const server: TreeItems = [makeItem(1, 'Task'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.merged.find((i) => i.id === 'trash')).toBeDefined();
    expect(result.merged.find((i) => i.id === 'trash')?.value).toBe('Trash');
  });

  it('accepts deletion when unmodified item is deleted locally', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local: TreeItems = [makeItem(1, 'Task A'), makeTrash()];
    const server = structuredClone(base);

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 2)).toBeUndefined();
  });

  it('accepts deletion when unmodified item is deleted on server', () => {
    const base: TreeItems = [makeItem(1, 'Task A'), makeItem(2, 'Task B'), makeTrash()];
    const local = structuredClone(base);
    const server: TreeItems = [makeItem(1, 'Task A'), makeTrash()];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    expect(result.merged.find((i) => i.id === 2)).toBeUndefined();
  });

  it('handles nested children correctly', () => {
    const base: TreeItems = [
      {
        id: 1,
        value: 'Parent',
        children: [
          { id: 2, value: 'Child A', children: [] },
          { id: 3, value: 'Child B', children: [] },
        ],
      },
      makeTrash(),
    ];
    const local: TreeItems = [
      {
        id: 1,
        value: 'Parent',
        children: [
          { id: 2, value: 'Child A edited', children: [] },
          { id: 3, value: 'Child B', children: [] },
        ],
      },
      makeTrash(),
    ];
    const server: TreeItems = [
      {
        id: 1,
        value: 'Parent',
        children: [
          { id: 2, value: 'Child A', children: [] },
          { id: 3, value: 'Child B edited', children: [] },
        ],
      },
      makeTrash(),
    ];

    const result = mergeTreeItems(base, local, server);

    expect(result.hasConflicts).toBe(false);
    const parent = result.merged.find((i) => i.id === 1);
    expect(parent).toBeDefined();
    const childA = parent?.children.find((c) => c.id === 2);
    const childB = parent?.children.find((c) => c.id === 3);
    expect(childA?.value).toBe('Child A edited');
    expect(childB?.value).toBe('Child B edited');
  });
});
