import Dexie, { Table } from 'dexie';
import { UniqueIdentifier } from '@dnd-kit/core';
import type { TreesListItemIncludingItems, TreesList } from './types/types';

export interface AppStateItem {
  id: number;
  timestamp: number;
  quickMemo: string;
  settings: {
    darkMode: boolean;
    hideDoneItems: boolean;
  };
  treesList: TreesList;
}

class MyDexieDB extends Dexie {
  appstate!: Table<AppStateItem, number>;  // <データ型, プライマリキーの型>
  treestate!: Table<TreesListItemIncludingItems, UniqueIdentifier>;

  constructor() {
    super("taskTreesDatabase");
    this.version(1).stores({
      appstate: 'id, timestamp, quickMemo, settings, treeList',
      treestate: 'id, name, members, membersV2, timestamp, items'
    });
    this.version(2).stores({
      appstate: 'id, timestamp, quickMemo, settings, treeList',
      treestate: 'id, name, members, membersV2, timestamp, isArchived, items'
    });
  }
}

export const indexedDb = new MyDexieDB();

