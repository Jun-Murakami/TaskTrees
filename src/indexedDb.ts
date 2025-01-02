import Dexie, { Table } from 'dexie';
import { UniqueIdentifier } from '@dnd-kit/core';
import type { TreesListItemIncludingItems, TreesList } from './types/types';

export interface AppStateItem {
  id: number;
  uid?: string;
  timestamp: number;
  quickMemo: string;
  quickMemoV2?: string[];
  currentMemo?: number;
  settings: {
    darkMode: boolean;
    hideDoneItems: boolean;
  };
  treesList: TreesList;
}

class MyDexieDB extends Dexie {
  appstate!: Table<AppStateItem, number>; // <データ型, プライマリキーの型>
  treestate!: Table<TreesListItemIncludingItems, UniqueIdentifier>;

  constructor() {
    super('taskTreesDatabase');
    this.version(1).stores({
      appstate: 'id, timestamp, quickMemo, settings, treeList',
      treestate: 'id, name, members, membersV2, timestamp, items',
    });
    this.version(2).stores({
      appstate: 'id, timestamp, quickMemo, settings, treeList',
      treestate: 'id, name, members, membersV2, timestamp, isArchived, items',
    });
    this.version(3).stores({
      appstate: 'id, uid, timestamp, quickMemo, settings, treeList',
      treestate: 'id, name, members, membersV2, timestamp, isArchived, items',
    });
    this.version(4).stores({
      appstate: 'id, uid, timestamp, quickMemo, quickMemoV2, currentMemo, settings, treeList',
      treestate: 'id, name, members, membersV2, timestamp, isArchived, items',
    });
  }
}

export const indexedDb = new MyDexieDB();
