import { TreesList } from '@/types/types';

/**
 * Additive trees-list merge for tree creation / import.
 *
 * `users/{uid}/treeList` is the single source of truth for which trees a user
 * can see, and the client persists it with a whole-array `set()`
 * (see `databaseService.saveTreesListDb`). Adding a tree is a purely *additive*
 * operation: it must never drop another device's trees.
 *
 * The bug this guards against: during the very first sync after a fresh
 * install, the in-memory `treesList` store is still empty (the authoritative
 * list has not been loaded yet). `handleCreateNewTree` used to append the new
 * tree to that empty in-memory list and write the result straight back to the
 * server, overwriting `users/{uid}/treeList` with just `[newTree]` and
 * destroying the pointers to every tree created on other devices. After the
 * next sync those trees were gone everywhere. See `treesListMerge.test.ts`.
 *
 * The fix bases the write on the authoritative server list (re-read immediately
 * before writing), unions in anything the local list knows about, and only then
 * appends the freshly added trees. Order is: server order first (cross-device
 * stable), then local-only entries, then the new trees — de-duplicated by id so
 * a tree is never listed twice.
 */
export function buildTreesListAfterAdd(
  serverList: TreesList,
  localList: TreesList,
  addedTrees: TreesList
): TreesList {
  const seen = new Set<string>();
  const result: TreesList = [];
  const push = (tree: TreesList[number]): void => {
    const key = String(tree.id);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(tree);
  };
  // Authoritative server order first (stable across devices), then any
  // local-only entries the server has not stored yet, then the new trees.
  serverList.forEach(push);
  localList.forEach(push);
  addedTrees.forEach(push);
  return result;
}
