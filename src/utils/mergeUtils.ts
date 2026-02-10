import type { UniqueIdentifier } from '@dnd-kit/core';
import type { TreeItem, TreeItems, FlattenedItem } from '@/types/types';

// ---- Types ----

export type ConflictDetail = {
  itemId: UniqueIdentifier;
  field: string;
  localValue: unknown;
  serverValue: unknown;
  resolution: 'server-wins' | 'local-wins' | 'merged';
};

export type MergeResult = {
  merged: TreeItems;
  hasConflicts: boolean;
  conflictDetails: ConflictDetail[];
  strategy: 'auto' | 'manual';
};

// ---- Internal flatten/build (avoids navigator.platform side-effect from utilities.ts) ----

function flatten(items: TreeItems, parentId: UniqueIdentifier | null = null, depth = 0): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...flatten(item.children, item.id, depth + 1),
    ];
  }, []);
}

function flattenTree(items: TreeItems): FlattenedItem[] {
  return flatten(items);
}

function buildTree(flattenedItems: FlattenedItem[]): TreeItems {
  const root: TreeItem = { id: 'root', children: [], value: '' };
  const nodes: Record<string, TreeItem> = { [root.id]: root };
  const items = flattenedItems.map((item) => ({ ...item, children: [] as TreeItem[] }));

  for (const item of items) {
    const { id } = item;
    const parentId = item.parentId ?? root.id;
    const parent = nodes[parentId as string] ?? items.find((i) => i.id === parentId);

    nodes[id as string] = { id, children: item.children, value: item.value };
    if (parent) {
      parent.children.push(item);
    }
  }

  return root.children;
}

// ---- Helpers ----

type ItemMap = Map<
  UniqueIdentifier,
  {
    item: FlattenedItem;
    parentId: UniqueIdentifier | null;
    index: number;
  }
>;

/** Comparable content fields (excluding structural: parentId, depth, index, children) */
const CONTENT_FIELDS: (keyof TreeItem)[] = [
  'value',
  'done',
  'collapsed',
  'attachedFile',
  'timer',
  'isUpLift',
  'upLiftMinute',
  'isNotify',
  'notifyMinute',
];

function buildItemMap(items: TreeItems): ItemMap {
  const flat = flattenTree(items);
  const map: ItemMap = new Map();
  for (const fi of flat) {
    map.set(fi.id, { item: fi, parentId: fi.parentId, index: fi.index });
  }
  return map;
}

function collectAllIds(...maps: ItemMap[]): Set<UniqueIdentifier> {
  const ids = new Set<UniqueIdentifier>();
  for (const m of maps) {
    for (const id of m.keys()) {
      ids.add(id);
    }
  }
  return ids;
}

function getField(item: FlattenedItem, field: keyof TreeItem): unknown {
  return item[field as keyof FlattenedItem];
}

function fieldChanged(a: FlattenedItem, b: FlattenedItem, field: keyof TreeItem): boolean {
  const va = getField(a, field);
  const vb = getField(b, field);
  if (va === undefined && vb === undefined) return false;
  return va !== vb;
}

function setField(item: FlattenedItem, field: keyof TreeItem, value: unknown): void {
  (item as unknown as Record<string, unknown>)[field] = value;
}

function toCleanTreeItem(fi: FlattenedItem): Omit<FlattenedItem, 'children'> & { children: TreeItem[] } {
  return {
    id: fi.id,
    value: fi.value,
    children: [],
    parentId: fi.parentId,
    depth: fi.depth,
    index: fi.index,
    ...(fi.collapsed !== undefined && { collapsed: fi.collapsed }),
    ...(fi.done !== undefined && { done: fi.done }),
    ...(fi.attachedFile !== undefined && { attachedFile: fi.attachedFile }),
    ...(fi.timer !== undefined && { timer: fi.timer }),
    ...(fi.isUpLift !== undefined && { isUpLift: fi.isUpLift }),
    ...(fi.upLiftMinute !== undefined && { upLiftMinute: fi.upLiftMinute }),
    ...(fi.isNotify !== undefined && { isNotify: fi.isNotify }),
    ...(fi.notifyMinute !== undefined && { notifyMinute: fi.notifyMinute }),
  };
}

// ---- Core merge ----

export function mergeTreeItems(
  base: TreeItems | null,
  local: TreeItems,
  server: TreeItems
): MergeResult {
  // If no base snapshot, fall back to server wins
  if (!base || base.length === 0) {
    return {
      merged: server,
      hasConflicts: false,
      conflictDetails: [],
      strategy: 'auto',
    };
  }

  const baseMap = buildItemMap(base);
  const localMap = buildItemMap(local);
  const serverMap = buildItemMap(server);
  const allIds = collectAllIds(baseMap, localMap, serverMap);

  const conflicts: ConflictDetail[] = [];
  const mergedFlat: FlattenedItem[] = [];

  for (const id of allIds) {
    const inBase = baseMap.has(id);
    const inLocal = localMap.has(id);
    const inServer = serverMap.has(id);

    const baseEntry = baseMap.get(id);
    const localEntry = localMap.get(id);
    const serverEntry = serverMap.get(id);

    // --- Deletion cases ---
    if (inBase && !inLocal && !inServer) {
      // Both deleted: skip
      continue;
    }
    if (inBase && !inLocal && inServer) {
      // Deleted locally, exists on server
      // Check if server modified it
      const serverModified = CONTENT_FIELDS.some(
        (f) => baseEntry && serverEntry && fieldChanged(baseEntry.item, serverEntry.item, f)
      );
      if (serverModified) {
        // Data safety: restore server version
        mergedFlat.push(toCleanTreeItem(serverEntry!.item) as FlattenedItem);
      }
      // else: local delete wins (server unchanged)
      continue;
    }
    if (inBase && inLocal && !inServer) {
      // Deleted on server, exists locally
      const localModified = CONTENT_FIELDS.some(
        (f) => baseEntry && localEntry && fieldChanged(baseEntry.item, localEntry.item, f)
      );
      if (localModified) {
        // Data safety: restore local version
        mergedFlat.push(toCleanTreeItem(localEntry!.item) as FlattenedItem);
      }
      // else: server delete wins (local unchanged)
      continue;
    }

    // --- Addition cases ---
    if (!inBase && inLocal && !inServer) {
      // Added locally only
      mergedFlat.push(toCleanTreeItem(localEntry!.item) as FlattenedItem);
      continue;
    }
    if (!inBase && !inLocal && inServer) {
      // Added on server only
      mergedFlat.push(toCleanTreeItem(serverEntry!.item) as FlattenedItem);
      continue;
    }
    if (!inBase && inLocal && inServer) {
      // Added on both sides — merge fields (server wins for conflicts)
      const merged = mergeItemFields(
        localEntry!.item,
        localEntry!.item, // no base, use local as "base" for field diff
        serverEntry!.item,
        id,
        conflicts
      );
      // Use server structural position
      merged.parentId = serverEntry!.parentId;
      merged.index = serverEntry!.index;
      merged.depth = serverEntry!.item.depth;
      mergedFlat.push(merged);
      continue;
    }

    // --- Both exist in all three: potential modification ---
    if (inBase && inLocal && inServer) {
      const baseItem = baseEntry!.item;
      const localItem = localEntry!.item;
      const serverItem = serverEntry!.item;

      // Merge content fields
      const merged = mergeItemFields(baseItem, localItem, serverItem, id, conflicts);

      // Merge structural position (parentId + index)
      const localParentChanged = localEntry!.parentId !== baseEntry!.parentId;
      const serverParentChanged = serverEntry!.parentId !== baseEntry!.parentId;
      const localIndexChanged = localEntry!.index !== baseEntry!.index;
      const serverIndexChanged = serverEntry!.index !== baseEntry!.index;

      if (localParentChanged && !serverParentChanged) {
        merged.parentId = localEntry!.parentId;
        merged.index = localEntry!.index;
        merged.depth = localItem.depth;
      } else if (!localParentChanged && serverParentChanged) {
        merged.parentId = serverEntry!.parentId;
        merged.index = serverEntry!.index;
        merged.depth = serverItem.depth;
      } else if (localParentChanged && serverParentChanged) {
        // Both moved — server wins
        merged.parentId = serverEntry!.parentId;
        merged.index = serverEntry!.index;
        merged.depth = serverItem.depth;
      } else {
        // Neither parent changed
        if (localIndexChanged && !serverIndexChanged) {
          merged.index = localEntry!.index;
        } else if (!localIndexChanged && serverIndexChanged) {
          merged.index = serverEntry!.index;
        } else if (localIndexChanged && serverIndexChanged) {
          // Both reordered — server wins
          merged.index = serverEntry!.index;
        } else {
          merged.index = baseEntry!.index;
        }
        merged.parentId = baseEntry!.parentId;
        merged.depth = baseItem.depth;
      }

      mergedFlat.push(merged);
      continue;
    }
  }

  // Sort by parentId grouping then index for buildTree
  mergedFlat.sort((a, b) => {
    // Root items first (null parentId)
    const aParent = a.parentId ?? '';
    const bParent = b.parentId ?? '';
    if (aParent < bParent) return -1;
    if (aParent > bParent) return 1;
    return a.index - b.index;
  });

  // Rebuild tree
  const merged = buildTree(mergedFlat);

  return {
    merged,
    hasConflicts: conflicts.length > 0,
    conflictDetails: conflicts,
    strategy: 'auto',
  };
}

/** Merge content fields of a single item using 3-way comparison */
function mergeItemFields(
  baseItem: FlattenedItem,
  localItem: FlattenedItem,
  serverItem: FlattenedItem,
  itemId: UniqueIdentifier,
  conflicts: ConflictDetail[]
): FlattenedItem {
  // Start from base, apply changes
  const result = toCleanTreeItem(baseItem) as FlattenedItem;

  for (const field of CONTENT_FIELDS) {
    const localChanged = fieldChanged(baseItem, localItem, field);
    const serverChanged = fieldChanged(baseItem, serverItem, field);

    if (localChanged && !serverChanged) {
      setField(result, field, getField(localItem, field));
    } else if (!localChanged && serverChanged) {
      setField(result, field, getField(serverItem, field));
    } else if (localChanged && serverChanged) {
      const localVal = getField(localItem, field);
      const serverVal = getField(serverItem, field);
      if (localVal === serverVal) {
        setField(result, field, localVal);
      } else {
        setField(result, field, serverVal);
        conflicts.push({
          itemId,
          field,
          localValue: localVal,
          serverValue: serverVal,
          resolution: 'server-wins',
        });
      }
    }
  }

  return result;
}
