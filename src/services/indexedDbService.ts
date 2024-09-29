import { indexedDb as idb, type AppStateItem } from '@/indexedDb';
import { UniqueIdentifier } from '@dnd-kit/core';
import { ensureChildrenProperty } from '@/features/sortableTree/utilities';
import type { TreesList, TreeItems } from '@/types/types';

// AppStateの読み込み
export const loadAppStateFromIdb = async (): Promise<AppStateItem | undefined> => {
  try {
    return await idb.appstate.get(1);
  } catch (error) {
    throw new Error('IndexedDBからのAppStateの読み込みに失敗しました。' + error);
  }
};

// クイックメモの読み込み
export const loadQuickMemoFromIdb = async (): Promise<string | undefined> => {
  try {
    const appState = await idb.appstate.get(1);
    return appState?.quickMemo;
  } catch (error) {
    throw new Error('IndexedDBからのクイックメモの読み込みに失敗しました。' + error);
  }
};

// ツリーリストの読み込み
export const loadTreesListFromIdb = async (): Promise<TreesList | undefined> => {
  try {
    const appState = await idb.appstate.get(1);
    return appState?.treesList;
  } catch (error) {
    throw new Error('IndexedDBからのツリーリストの読み込みに失敗しました。' + error);
  }
};

// クイックメモの保存
export const saveQuickMemoToIdb = async (quickMemoText: string) => {
  try {
    await idb.appstate.update(1, { quickMemo: quickMemoText });
  } catch (error) {
    throw new Error('IndexedDBへのクイックメモの保存に失敗しました。' + error);
  }
};

// ダークモードと完了済みアイテムの非表示設定の保存
export const saveAppStateToIdb = async (darkMode: boolean, hideDoneItems: boolean) => {
  try {
    await idb.appstate.update(1, { settings: { darkMode: darkMode, hideDoneItems: hideDoneItems } });
  } catch (error) {
    throw new Error('IndexedDBへのダークモードと完了済みアイテムの非表示設定の保存に失敗しました。' + error);
  }
};

// ツリーリストの保存
export const saveTreesListToIdb = async (treesList: TreesList) => {
  try {
    await idb.appstate.update(1, { treesList: treesList });
  } catch (error) {
    throw new Error('IndexedDBへのツリーリストの保存に失敗しました。' + error);
  }
};

// ターゲットIDのitems、name、membersをDBからロードする
export const loadCurrentTreeDataFromIdb = async (targetTree: UniqueIdentifier) => {
  try {
    const treeData = await idb.treestate.get(targetTree);
    if (treeData) {
      const ensuredItems = ensureChildrenProperty(treeData.items);
      const ensuredTreeData = { ...treeData, items: ensuredItems };
      return ensuredTreeData;
    } else {
      throw new Error('IndexedDBのツリーデータが取得できませんでした。');
    }
  } catch (error) {
    throw new Error('IndexedDBからのツリーデータの読み込みに失敗しました。' + error);
  }
};

// ツリーItemsの保存
export const saveItemsToIdb = async (targetTree: UniqueIdentifier, newItems: TreeItems) => {
  try {
    const treeData = await idb.treestate.get(targetTree);
    if (treeData) {
      treeData.items = newItems;
      treeData.timestamp = Date.now();
      await idb.treestate.put(treeData);
    } else {
      throw new Error('IndexedDBのツリーデータが取得できませんでした。');
    }
  } catch (error) {
    throw new Error('IndexedDBへのツリーデータの保存に失敗しました。' + error);
  }
};

// ツリー名を更新
export const saveCurrentTreeNameToIdb = async (targetTree: UniqueIdentifier, editedTreeName: string) => {
  try {
    const treeData = await idb.treestate.get(targetTree);
    if (treeData) {
      treeData.name = editedTreeName;
      treeData.timestamp = Date.now();
      await idb.treestate.put(treeData);
    }
  } catch (error) {
    throw new Error('IndexedDBへのツリー名の保存に失敗しました。' + error);
  }
};

// ツリーの削除
export const deleteTreeFromIdb = async (targetTree: UniqueIdentifier) => {
  try {
    await idb.treestate.delete(targetTree);
  } catch (error) {
    throw new Error('IndexedDBからのツリーの削除に失敗しました。' + error);
  }
};

// タイムスタンプの保存
export const saveTimeStampToIdb = async (targetTree: UniqueIdentifier | null, newTimestamp: number) => {
  try {
    await idb.appstate.update(1, { timestamp: newTimestamp });

    if (targetTree) {
      const treeData = await idb.treestate.get(targetTree);
      if (treeData) {
        treeData.timestamp = newTimestamp;
        await idb.treestate.put(treeData);
      }
    }
  } catch (error) {
    throw new Error('IndexedDBへのタイムスタンプの保存に失敗しました。' + error);
  }
};

// appStateデータベースの初期化
export const initializeAppStateIdb = async (timestamp: number, quickMemo: string, darkMode: boolean, hideDoneItems: boolean, treesList: TreesList) => {
  try {
    await idb.appstate.clear();
    await idb.appstate.put({
      id: 1,
      timestamp: timestamp,
      quickMemo: quickMemo,
      settings: {
        darkMode: darkMode,
        hideDoneItems: hideDoneItems,
      },
      treesList: treesList,
    });
  } catch (error) {
    throw new Error('IndexedDBのappStateの初期化に失敗しました。' + error);
  }
};

// ツリーデータの初期化
export const initializeTreeDataIdb = async () => {
  try {
    await idb.treestate.clear();
  } catch (error) {
    throw new Error('IndexedDBのツリーデータの初期化に失敗しました。' + error);
  }
};

// ツリーの保存
export const saveTreeToIdb = async (id: UniqueIdentifier, name: string, members: string[], membersV2: { [key: string]: string }, timestamp: number, items: TreeItems) => {
  try {
    await idb.treestate.put({
      id: id,
      name: name,
      members: members,
      membersV2: membersV2,
      timestamp: timestamp,
      items: items,
    });
  } catch (error) {
    throw new Error('IndexedDBへのツリーの保存に失敗しました。' + error);
  }
};

// データベースが空かどうかをチェック
export const checkDbEmpty = async () => {
  try {
    const appState = await idb.appstate.count();
    return appState === 0;
  } catch (error) {
    throw new Error('IndexedDBのデータベースが空かどうかのチェックに失敗しました。' + error);
  }
};
