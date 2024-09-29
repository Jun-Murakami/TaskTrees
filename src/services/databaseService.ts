import { getDatabase, ref, set, get } from 'firebase/database';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { indexedDb as idb } from '@/indexedDb';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItems, TreesList, TreesListItem, TreesListItemIncludingItems } from '@/types/types';

type currentTreeMembers = { uid: string; email: string }[] | null;

// タイムスタンプをデータベースに保存する関数
export const saveTimeStampDb = async (uid: string, targetTree: UniqueIdentifier | null, currentTreeMembers: currentTreeMembers, newTimestamp: number) => {
  const db = getDatabase();
  if (!uid) {
    return;
  }
  try {
    // indexDBのタイムスタンプを更新
    await idb.appstate.update(1, { timestamp: newTimestamp });

    // ユーザーのタイムスタンプV2を更新
    const timestampV2Ref = ref(db, `users/${uid}/timestampV2`);
    await set(timestampV2Ref, newTimestamp);

    // ユーザーのタイムスタンプを更新
    const timestampRef = ref(db, `users/${uid}/timestamp`);
    await set(timestampRef, newTimestamp);

    // ツリーのタイムスタンプを更新
    if (targetTree) {
      const treeRef = ref(db, `trees/${targetTree}/timestamp`);
      await set(treeRef, newTimestamp).catch(async (error) => {
        if (error.code === 'PERMISSION_DENIED') {
          const updateTreeTimestamp = httpsCallable(getFunctions(), 'updateTreeTimestamp');
          await updateTreeTimestamp({ treeId: targetTree, timestamp: newTimestamp });
        }
      });
    }

    // 自分以外のメンバーのuidを抽出してタイムスタンプを更新
    const treeMemberUids = currentTreeMembers?.filter((member) => member.uid !== uid).map((member) => member.uid);
    if (treeMemberUids && treeMemberUids.length > 0) {
      const updateTimestamps = httpsCallable(getFunctions(), 'updateTimestamps');
      await updateTimestamps({ uids: treeMemberUids, timestamp: newTimestamp });
    }
    return;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// ツリーのタイムスタンプを取得する関数
export const loadTreeTimestampFromDb = async (uid: string, targetTree: UniqueIdentifier): Promise<number | null> => {
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
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// itemsをデータベースに保存する関数
export const saveItemsDb = async (uid: string, targetTree: UniqueIdentifier, newItems: TreeItems) => {
  if (!uid || !targetTree || !newItems) {
    return;
  }
  try {
    // undefinedのプロパティを削除
    const removeUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
      Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') {
          removeUndefined(obj[key] as Record<string, unknown>);
        } else if (obj[key] === undefined) {
          delete obj[key];
        }
      });
      return obj;
    };
    const cleanedItems = removeUndefined(JSON.parse(JSON.stringify(newItems)));

    const treeStateRef = ref(getDatabase(), `trees/${targetTree}/items`);
    // 更新対象が存在するかチェック
    const snapshot = await get(treeStateRef);
    if (snapshot.exists()) {
      // 存在する場合、更新を実行
      await set(treeStateRef, cleanedItems)
    } else {
      // 存在しない場合、エラーハンドリング
      throw new Error('更新対象のsnapshotが存在しません。ツリー内容の変更は破棄されました。code:4');
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// treesListをデータベースに保存する関数
export const saveTreesListDb = async (uid: string, newTreesList: TreesList) => {
  if (!uid || !newTreesList) {
    return;
  }
  try {
    const treeListRef = ref(getDatabase(), `users/${uid}/treeList`);
    await set(treeListRef, newTreesList);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// currentTreeNameをデータベースに保存する関数
export const saveCurrentTreeNameDb = async (uid: string, targetTree: UniqueIdentifier, newTreeName: string) => {
  if (!uid || !targetTree || !newTreeName) {
    return;
  }
  try {
    const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`);
    await set(treeNameRef, newTreeName);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// データベースからツリーを削除する関数
export const deleteTreeFromDb = async (targetTree: UniqueIdentifier) => {
  try {
    const treeRef = ref(getDatabase(), `trees/${targetTree}`);
    await set(treeRef, null);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// データベースからツリーの名前のみを取得する関数
export const loadTreeNameFromDb = async (targetTree: UniqueIdentifier): Promise<string | null> => {
  if (!targetTree) {
    return null;
  }
  try {
    const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`);
    const snapshot = await get(treeNameRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// データベースからツリーリストを取得する関数
export const loadTreesListFromDb = async (uid: string): Promise<{ orderedTreesList: TreesList, missingTrees: UniqueIdentifier[] }> => {
  if (!uid) {
    return { orderedTreesList: [], missingTrees: [] };
  }
  try {
    const userTreeListRef = ref(getDatabase(), `users/${uid}/treeList`);
    const snapshot = await get(userTreeListRef);
    if (snapshot.exists()) {
      let missingTrees: UniqueIdentifier[] = [];
      const data: TreesList = snapshot.val();
      let treesListAccumulator: TreesList = [];
      // 反復してツリー名をDBから取得
      const promises = data.map(async (tree) => {
        const treeTitle = await loadTreeNameFromDb(tree.id);
        if (treeTitle) {
          treesListAccumulator = [...treesListAccumulator, { id: tree.id, name: treeTitle }];
        } else {
          missingTrees = missingTrees ? [...missingTrees, tree.id] : [tree.id];
        }
      });
      await Promise.all(promises);

      // DBの順序に基づいてtreesListAccumulatorを並び替え
      const orderedTreesList = data
        .map((tree) => treesListAccumulator.find((t) => t.id === tree.id))
        .filter((t): t is TreesListItem => t !== undefined);

      return { orderedTreesList, missingTrees };
    } else {
      return { orderedTreesList: [], missingTrees: [] };
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// データベースからツリーのitemsのみを取得する関数
export const loadItemsFromDb = async (targetTree: UniqueIdentifier): Promise<TreeItems | null> => {
  try {
    const treeItemsRef = ref(getDatabase(), `trees/${targetTree}/items`);
    const snapshot = await get(treeItemsRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// データベースからツリーメンバーのみを取得する関数
export const loadMembersFromDb = async (targetTree: UniqueIdentifier): Promise<string[] | null> => {
  try {
    const treeMembersRef = ref(getDatabase(), `trees/${targetTree}/members`);
    const snapshot = await get(treeMembersRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
};

// treeListを反復して、データベースからすべてのitemsとnameを取得する関数
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
export const loadAllTreesDataFromDb = async (treesList: TreesList) => {

  try {
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
  } catch (error) {
    throw new Error(error instanceof Error ? error.message + '\n\n' + error.stack : 'unknown error');
  }
}