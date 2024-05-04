import { indexedDb as idb } from '../indexedDb';
import { UniqueIdentifier } from '@dnd-kit/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useDialogStore } from '../store/dialogStore';
import { TreeItems, TreesList, TreesListItem, TreesListItemIncludingItems } from '../types/types';
import { isTreeItemArray, validateTreeItems } from '../components/SortableTree/utilities';
import { getDatabase, ref, set, get } from 'firebase/database';
import { useError } from './useError';

// データベースに関連するカスタムフック
// 他の場所にはデータベースの処理は書かないようにする

export const useDatabase = () => {
  const uid = useAppStateStore((state) => state.uid);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const currentTreeMembers = useTreeStateStore((state) => state.currentTreeMembers);
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  const showDialog = useDialogStore((state) => state.showDialog);

  const { handleError } = useError();

  // タイムスタンプをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveTimeStampDb = async () => {
    if (!uid) {
      return;
    }
    try {
      const newTimestamp = Date.now();

      // ローカルのタイムスタンプを更新
      setLocalTimestamp(newTimestamp);

      // indexDBのタイムスタンプを更新
      await idb.appstate.update(1, { timestamp: newTimestamp });

      // ユーザーのタイムスタンプを更新
      const timestampRef = ref(getDatabase(), `users/${uid}/timestamp`);
      await set(timestampRef, newTimestamp);

      // ユーザーのタイムスタンプV2を更新
      const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
      await set(timestampV2Ref, newTimestamp);

      // ツリーのタイムスタンプを更新
      if (currentTree) {
        const treeRef = ref(getDatabase(), `trees/${currentTree}/timestamp`);
        await set(treeRef, newTimestamp);
      }

      // 自分以外のメンバーのuidを抽出してタイムスタンプを更新
      const treeMemberUids = currentTreeMembers?.filter((member) => member.uid !== uid).map((member) => member.uid);
      if (treeMemberUids && treeMemberUids.length > 0) {
        const functions = getFunctions();
        const updateTimestamps = httpsCallable(functions, 'updateTimestamps');
        await updateTimestamps({ uids: treeMemberUids, timestamp: newTimestamp });
      }

      return;
    } catch (error) {
      handleError('タイムスタンプの保存に失敗しました。\n\n' + error);
    }
  };

  // ツリーのタイムスタンプを取得する関数 ---------------------------------------------------------------------------
  const loadTreeTimestampFromDb = async (targetTree: UniqueIdentifier): Promise<number | null> => {
    if (!uid || !targetTree) {
      return null;
    }
    try {
      const treeRef = ref(getDatabase(), `trees/${targetTree}/timestamp`);
      return await get(treeRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            return snapshot.val();
          }
          return null;
        })
        .catch(() => {
          return null;
        });
    } catch (error) {
      handleError('タイムスタンプの取得に失敗しました。\n\n' + error);
      return null;
    }
  };

  // itemsをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveItemsDb = async (newItems: TreeItems, targetTree: UniqueIdentifier) => {
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

      const treeStateRef = ref(getDatabase(), `trees/${targetTree}/items`);
      // 更新対象が存在するかチェック
      await get(treeStateRef)
        .then(async (snapshot) => {
          if (snapshot.exists()) {
            // 存在する場合、更新を実行
            await saveTimeStampDb();
            await set(treeStateRef, newItems).catch((error) => {
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
  const saveTreesListDb = async (newTreesList: TreesList) => {
    if (!uid) {
      return;
    }
    try {
      const userTreeListRef = ref(getDatabase(), `users/${uid}/treeList`);
      await saveTimeStampDb();
      await set(
        userTreeListRef,
        newTreesList.map((tree) => tree.id)
      );
    } catch (error) {
      handleError('ツリーリストの変更をデータベースに保存できませんでした。\n\n' + error);
    }
  };

  // currentTreeNameをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveCurrentTreeNameDb = async (editedTreeName: string, targetTree: UniqueIdentifier | null) => {
    if (!uid || !targetTree || !editedTreeName) {
      return;
    }
    try {
      const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`);
      await saveTimeStampDb();
      await set(treeNameRef, editedTreeName);
    } catch (error) {
      handleError('ツリー名の変更をデータベースに保存できませんでした。\n\n' + error);
    }
  };

  // データベースからツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTreeFromDb = async (targetTree: UniqueIdentifier) => {
    const treeRef = ref(getDatabase(), `trees/${targetTree}`);
    try {
      await saveTimeStampDb();
      await set(treeRef, null);
    } catch (error) {
      handleError('ツリーの削除に失敗しました。\n\n' + error);
    }
  };

  // データベースからツリーリストを取得する関数 ---------------------------------------------------------------------------
  const loadTreesListFromDb = async (userId: string): Promise<TreesList> => {
    const userTreeListRef = ref(getDatabase(), `users/${userId}/treeList`);
    return await get(userTreeListRef)
      .then(async (snapshot) => {
        if (snapshot.exists()) {
          let missingTrees: string[] = [];
          const data: string[] = snapshot.val();
          let treesListAccumulator: TreesList = [];
          // 反復してツリー名をDBから取得
          const promises = data.map(async (treeId) => {
            const treeTitle = await loadTreeNameFromDb(treeId);
            if (treeTitle) {
              treesListAccumulator = [...treesListAccumulator, { id: treeId, name: treeTitle }];
            } else {
              console.log('ツリー名が取得できませんでした。' + treeId + 'のツリーは削除されている可能性があります。');
              missingTrees = missingTrees ? [...missingTrees, treeId] : [treeId];
            }
          });
          await Promise.all(promises);
          // DBの順序に基づいてtreesListAccumulatorを並び替え
          const orderedTreesList = data
            .map((treeId) => treesListAccumulator.find((t) => t.id === treeId))
            .filter((t): t is TreesListItem => t !== undefined);
          return orderedTreesList;
        } else {
          console.log('ツリーリストが見つかりませんでした。');
          return [];
        }
      })
      .catch((error) => {
        console.log('ツリーリストのDBフェッチに失敗しました。\n\n' + error);
        return [];
      });
  };

  // データベースからツリーの名前のみを取得する関数 ---------------------------------------------------------------------------
  const loadTreeNameFromDb = async (targetTree: UniqueIdentifier): Promise<string | null> => {
    const treeTitleRef = ref(getDatabase(), `trees/${targetTree}/name`);
    return await get(treeTitleRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          return snapshot.val();
        }
        return null;
      })
      .catch(() => {
        return null;
      });
  };

  // データベースからツリーのitemsのみを取得する関数 ---------------------------------------------------------------------------
  const loadItemsFromDb = async (targetTree: UniqueIdentifier): Promise<TreeItems | null> => {
    const treeItemsRef = ref(getDatabase(), `trees/${targetTree}/items`);
    return await get(treeItemsRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          return snapshot.val();
        }
        return null;
      })
      .catch(() => {
        return null;
      });
  };

  // データベースからツリーメンバーのみを取得する関数 ---------------------------------------------------------------------------
  const loadMembersFromDb = async (targetTree: UniqueIdentifier): Promise<string[] | null> => {
    const treeMembersRef = ref(getDatabase(), `trees/${targetTree}/members`);
    return await get(treeMembersRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          return snapshot.val();
        }
        return null;
      })
      .catch(() => {
        return null;
      });
  };

  // treeListを反復して、データベースからすべてのitemsとnameを取得する関数 ---------------------------------------------------------------------------
  // treeDataがTreesListItemIncludingItems型かチェックするutil関数
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
    if (!uid) {
      return;
    }
    try {
      if (treesList) {
        const promises = treesList.map(async (treesListItem: TreesListItem) => {
          const treeRef = ref(getDatabase(), `trees/${treesListItem.id}`);
          const treeSnapshot = await get(treeRef);
          if (treeSnapshot.exists()) {
            const treeData = treeSnapshot.val();
            if (treeData && !(await isValiedTreesListItemIncludingItems(treeData))) {
              const treeItemsIncludingItems: TreesListItemIncludingItems = {
                id: treesListItem.id,
                name: treeData.name,
                members: treeData.members,
                membersV2: treeData.membersV2,
                timestamp: treeData.timestamp,
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
