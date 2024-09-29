import { useCallback } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { TreeItems, TreesList } from '@/types/types';
import { isTreeItemArray, validateTreeItems } from '@/features/sortableTree/utilities';
import * as dbService from '@/services/databaseService';
import { useError } from '@/hooks/useError';

// データベースに関連するカスタムフック
// 他の場所にはデータベースの処理は書かないようにする

export const useDatabase = () => {
  const showDialog = useDialogStore((state) => state.showDialog);

  const { handleError } = useError();

  // タイムスタンプをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveTimeStampDb = useCallback(async (targetTree: UniqueIdentifier | null) => {
    const uid = useAppStateStore.getState().uid;
    const setLocalTimestamp = useAppStateStore.getState().setLocalTimestamp;
    const currentTreeMembers = useTreeStateStore.getState().currentTreeMembers;
    if (!uid) {
      return;
    }
    try {
      const newTimestamp = Date.now();

      // ローカルのタイムスタンプを更新
      setLocalTimestamp(newTimestamp);

      await dbService.saveTimeStampDb(uid, targetTree, currentTreeMembers, newTimestamp);
    } catch (error) {
      handleError('タイムスタンプの保存に失敗しました。\n\n' + error);
    }
  }, [handleError]);

  // ツリーのタイムスタンプを取得する関数 ---------------------------------------------------------------------------
  const loadTreeTimestampFromDb = useCallback(async (targetTree: UniqueIdentifier): Promise<number | null> => {
    const uid = useAppStateStore.getState().uid;
    if (!uid || !targetTree) {
      return null;
    }
    try {
      return await dbService.loadTreeTimestampFromDb(uid, targetTree);
    } catch (error) {
      handleError('タイムスタンプの取得に失敗しました。\n\n' + error);
      return null;
    }
  }, [handleError]);

  // itemsをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveItemsDb = useCallback(async (newItems: TreeItems, targetTree: UniqueIdentifier) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid || !targetTree || !newItems) {
      return;
    }
    try {
      // newItemsの内容をチェック
      if (!isTreeItemArray(newItems)) {
        await showDialog('ツリーデータが不正のため、データベースへの保存がキャンセルされました。修正するにはツリーデータをダウンロードし、手動で修正してください。\n\n※ツリーデータが配列ではありません。', 'Error');
        return;
      }

      // newItemsの内容を詳細にチェック
      const result = validateTreeItems(newItems);
      if (result !== '') {
        await showDialog('ツリーデータが不正のため、データベースへの保存がキャンセルされました。修正するにはツリーデータをダウンロードし、手動で修正してください。\n\n' + result, 'Error');
        return;
      }

      await dbService.saveItemsDb(uid, targetTree, newItems);
      await saveTimeStampDb(targetTree);
    } catch (error) {
      handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
    }
  }, [handleError, showDialog, saveTimeStampDb]);

  // treesListをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveTreesListDb = useCallback(async (newTreesList: TreesList, noSaveTimestamp: boolean = false) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      await dbService.saveTreesListDb(uid, newTreesList);
      if (!noSaveTimestamp) {
        await saveTimeStampDb(null);
      }
    } catch (error) {
      handleError('ツリーリストの変更をデータベースに保存できませんでした。\n\n' + error);
    }
  }, [handleError, saveTimeStampDb]);

  // currentTreeNameをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveCurrentTreeNameDb = useCallback(async (editedTreeName: string, targetTree: UniqueIdentifier | null) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid || !targetTree || !editedTreeName) {
      return;
    }
    try {
      await dbService.saveCurrentTreeNameDb(uid, targetTree, editedTreeName);
      await saveTimeStampDb(targetTree);
    } catch (error) {
      handleError('ツリー名の変更をデータベースに保存できませんでした。\n\n' + error);
    }
  }, [handleError, saveTimeStampDb]);

  // データベースからツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTreeFromDb = useCallback(async (targetTree: UniqueIdentifier) => {
    try {
      await dbService.deleteTreeFromDb(targetTree);
      await saveTimeStampDb(null);
    } catch (error) {
      handleError('ツリーの削除に失敗しました。\n\n' + error);
    }
  }, [handleError, saveTimeStampDb]);

  // データベースからツリーの名前のみを取得する関数 ---------------------------------------------------------------------------
  const loadTreeNameFromDb = useCallback(async (targetTree: UniqueIdentifier): Promise<string | null> => {
    try {
      return await dbService.loadTreeNameFromDb(targetTree);
    } catch (error) {
      handleError('ツリー名の取得に失敗しました。\n\n' + error);
      return null;
    }
  }, [handleError]);

  // データベースからツリーリストを取得する関数 ---------------------------------------------------------------------------
  const loadTreesListFromDb = useCallback(async (userId: string): Promise<TreesList> => {
    try {
      const { orderedTreesList, missingTrees } = await dbService.loadTreesListFromDb(userId);
      if (missingTrees.length > 0) {
        await saveTreesListDb(orderedTreesList, true);
        await showDialog('１つ以上のツリーが削除されたか、アクセス権限が変更されました。\n\n' + missingTrees.join('\n'), 'Information');
      }
      return orderedTreesList;
    } catch (error) {
      handleError('ツリーリストの取得に失敗しました。\n\n' + error);
      return [];
    }
  }, [handleError, showDialog, saveTreesListDb]);

  // データベースからツリーのitemsのみを取得する関数 ---------------------------------------------------------------------------
  const loadItemsFromDb = useCallback(async (targetTree: UniqueIdentifier): Promise<TreeItems | null> => {
    try {
      return await dbService.loadItemsFromDb(targetTree);
    } catch (error) {
      handleError('ツリー内容の取得に失敗しました。\n\n' + error);
      return null;
    }
  }, [handleError]);

  // データベースからツリーメンバーのみを取得する関数 ---------------------------------------------------------------------------
  const loadMembersFromDb = useCallback(async (targetTree: UniqueIdentifier): Promise<string[] | null> => {
    try {
      return await dbService.loadMembersFromDb(targetTree);
    } catch (error) {
      handleError('ツリーメンバーの取得に失敗しました。\n\n' + error);
      return null;
    }
  }, [handleError]);

  // treeListを反復して、データベースからすべてのitemsとnameを取得する関数 ---------------------------------------------------------------------------
  const loadAllTreesDataFromDb = useCallback(async (treesList: TreesList) => {
    try {
      return await dbService.loadAllTreesDataFromDb(treesList);
    } catch (error) {
      handleError('ツリーデータの取得に失敗しました。\n\n' + error);
      return null;
    }
  }, [handleError]);

  return {
    saveItemsDb,
    saveTreesListDb,
    saveCurrentTreeNameDb,
    loadTreeTimestampFromDb,
    loadTreesListFromDb,
    loadTreeNameFromDb,
    loadItemsFromDb,
    loadMembersFromDb,
    loadAllTreesDataFromDb,
    deleteTreeFromDb,
    saveTimeStampDb,
  };
};
