import { UniqueIdentifier } from '@dnd-kit/core';
import { useAppStateStore } from '../store/appStateStore';
import { TreeItems, TreesList, TreesListItem, TreesListItemIncludingItems } from '../types/types';
import { isTreeItemArray } from '../components/SortableTree/utilities';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, get } from 'firebase/database';
import { useError } from './useError';

export const useDatabase = () => {
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  // エラーハンドリング
  const { handleError } = useError();
  // タイムスタンプの取得

  // データベースにタイムスタンプを保存する関数 ---------------------------------------------------------------------------
  const saveTimeStampDb = () => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    try {
      const newTimestamp = Date.now();
      setLocalTimestamp(newTimestamp);
      const timestampRef = ref(getDatabase(), `users/${user.uid}/timestamp`);
      set(timestampRef, newTimestamp);
      return newTimestamp;
    } catch (error) {
      handleError('タイムスタンプの保存に失敗しました。\n\n' + error);
    }
  };

  // itemsをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveItemsDb = (newItems: TreeItems, targetTree: UniqueIdentifier) => {
    if (!getAuth().currentUser || !targetTree || !newItems) {
      return;
    }
    try {
      // newItemsの内容をチェック
      if (!isTreeItemArray(newItems)) {
        handleError('保存内容のデータが配列ではありません。code:1');
        return;
      }

      const treeStateRef = ref(getDatabase(), `trees/${targetTree}/items`);
      // 更新対象が存在するかチェック
      get(treeStateRef)
        .then(async (snapshot) => {
          if (snapshot.exists()) {
            // 存在する場合、更新を実行
            saveTimeStampDb();
            set(treeStateRef, newItems).catch((error) => {
              handleError('データベースの保存に失敗しました。code:3\n\n' + error);
            });
          } else {
            // 存在しない場合、エラーハンドリング
            console.log('更新対象のsnapshotが存在しません。ツリー内容の変更は破棄されました。code:4');
          }
        })
        .catch((error) => {
          console.log('更新対象のitemsが存在しません。ツリー内容の変更は破棄されました。code:5 \n\n' + error);
        });
    } catch (error) {
      handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
    }
  };

  // treesListをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveTreesListDb = (newTreesList: TreesList) => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    try {
      const userTreeListRef = ref(getDatabase(), `users/${user.uid}/treeList`);
      saveTimeStampDb();
      set(
        userTreeListRef,
        newTreesList.map((tree) => tree.id)
      );
    } catch (error) {
      handleError('ツリーリストの変更をデータベースに保存できませんでした。\n\n' + error);
    }
  };

  // currentTreeNameをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveCurrentTreeNameDb = (editedTreeName: string, targetTree: UniqueIdentifier | null) => {
    const user = getAuth().currentUser;
    if (!user || !targetTree || !editedTreeName) {
      return;
    }
    try {
      const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`);
      saveTimeStampDb();
      set(treeNameRef, editedTreeName);
    } catch (error) {
      handleError('ツリー名の変更をデータベースに保存できませんでした。\n\n' + error);
    }
  };

  // データベースからツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTreeFromDb = (targetTree: UniqueIdentifier) => {
    const treeRef = ref(getDatabase(), `trees/${targetTree}`);
    try {
      saveTimeStampDb();
      set(treeRef, null);
    } catch (error) {
      handleError('ツリーの削除に失敗しました。\n\n' + error);
    }
  }

  // treeListを反復して、データベースからitemsとnameを取得する関数 ---------------------------------------------------------------------------
  // treeDataがTreesListItemIncludingItems型かチェックする関数
  const isValiedTreesListItemIncludingItems = async (arg: unknown): Promise<boolean> => {
    return (
      typeof arg === 'object' &&
      arg !== null &&
      'id' in arg &&
      typeof arg.id === 'string' &&
      'name' in arg &&
      typeof arg.name === 'string' &&
      'members' in arg &&
      typeof arg.members === 'object' &&
      'items' in arg &&
      Array.isArray(arg.items)
    );
  };
  // 本編
  const loadAllTreesDataFromDb = async (treesList: TreesList) => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    try {
      if (treesList) {
        const promises = treesList.map(async (treesListItem: TreesListItem) => {
          const treeRef = ref(getDatabase(), `trees/${treesListItem.id}`);
          const treeSnapshot = await get(treeRef);
          if (treeSnapshot.exists()) {
            const treeData = treeSnapshot.val();
            if (treeData && !await isValiedTreesListItemIncludingItems(treeData)) {
              const treeItemsIncludingItems: TreesListItemIncludingItems = {
                id: treesListItem.id,
                name: treeData.name,
                members: treeData.members,
                items: treeData.items,
              };
              return treeItemsIncludingItems;
            }
            throw new Error('ツリーデータが不正です。');
          }
          throw new Error('ツリーデータが見つかりません。');
        });
        const treeData = await Promise.all(promises);
        return treeData.filter((item) => item !== null);
      }
    } catch (error) {
      throw new Error('ツリーデータの取得に失敗しました。\n\n' + error);
    }
    return null;
  };

  return { saveItemsDb, saveTreesListDb, saveCurrentTreeNameDb, loadAllTreesDataFromDb, deleteTreeFromDb, saveTimeStampDb };
};
