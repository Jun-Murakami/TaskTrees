import { getDatabase, ref, set, get } from 'firebase/database';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { UniqueIdentifier } from '@dnd-kit/core';
import { isValidAppSettingsState } from '@/utils/appStateUtils';
import { TreeItems, TreesList, TreesListItem, TreesListItemIncludingItems, AppState } from '@/types/types';

type currentTreeMembers = { uid: string; email: string }[] | null;

// タイムスタンプをデータベースに保存する関数
export const saveTimeStampDb = async (
  uid: string,
  targetTree: UniqueIdentifier | null,
  currentTreeMembers: currentTreeMembers,
  newTimestamp: number
) => {
  try {
    // ユーザーのタイムスタンプV2を更新
    const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
    await set(timestampV2Ref, newTimestamp);

    // ユーザーのタイムスタンプを更新
    const timestampRef = ref(getDatabase(), `users/${uid}/timestamp`);
    await set(timestampRef, newTimestamp);

    // ツリーのタイムスタンプを更新
    if (targetTree) {
      const treeRef = ref(getDatabase(), `trees/${targetTree}/timestamp`);
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
    throw new Error('データベースへのタイムスタンプの保存に失敗しました。\n\n' + error);
  }
};

// ツリーのタイムスタンプを取得する関数
export const loadTreeTimestampFromDb = async (targetTree: UniqueIdentifier): Promise<number | null> => {
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
    console.log('データベースからのタイムスタンプの取得に失敗しました。\n\n' + error + '\n\n' + targetTree);
    return null;
  }
};

// itemsをデータベースに保存する関数
export const saveItemsDb = async (targetTree: UniqueIdentifier, newItems: TreeItems) => {
  try {
    // undefinedのプロパティを削除
    const removeUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
      Object.keys(obj).forEach((key) => {
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
      await set(treeStateRef, cleanedItems);
    } else {
      // 存在しない場合、エラーハンドリング
      throw new Error('更新対象のsnapshotが存在しません。ツリー内容の変更は破棄されました。code:4');
    }
  } catch (error) {
    throw new Error('データベースへのitemsの保存に失敗しました。\n\n' + error);
  }
};

// treesListをデータベースに保存する関数
export const saveTreesListDb = async (uid: string, newTreesList: TreesList) => {
  try {
    const treeListRef = ref(getDatabase(), `users/${uid}/treeList`);
    await set(treeListRef, newTreesList.map((tree) => tree.id));
  } catch (error) {
    throw new Error('データベースへのtreesListの保存に失敗しました。\n\n' + error);
  }
};

// currentTreeNameをデータベースに保存する関数
export const saveCurrentTreeNameDb = async (targetTree: UniqueIdentifier, newTreeName: string) => {
  try {
    const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`);
    await set(treeNameRef, newTreeName);
  } catch (error) {
    throw new Error('データベースへのツリー名の保存に失敗しました。\n\n' + error + '\n\n' + targetTree);
  }
};

// ツリーのアーカイブ属性をデータベースに保存する関数
export const saveIsArchivedDb = async (targetTree: UniqueIdentifier, isArchived: boolean | null) => {
  try {
    const treeRef = ref(getDatabase(), `trees/${targetTree}/isArchived`);
    await set(treeRef, isArchived);
  } catch (error) {
    throw new Error('データベースへのツリーのアーカイブ属性の保存に失敗しました。\n\n' + error + '\n\n' + targetTree);
  }
};

// データベースからツリーを削除する関数
export const deleteTreeFromDb = async (targetTree: UniqueIdentifier) => {
  try {
    const treeRef = ref(getDatabase(), `trees/${targetTree}`);
    await set(treeRef, null);
  } catch (error) {
    throw new Error('データベースからのツリーの削除に失敗しました。\n\n' + error + '\n\n' + targetTree);
  }
};

// データベースからツリーの名前のみを取得する関数
export const loadTreeNameFromDb = async (targetTree: UniqueIdentifier): Promise<string | null> => {
  try {
    const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`);
    const snapshot = await get(treeNameRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return null;
    }
  } catch (error) {
    console.log('データベースからのツリー名の取得に失敗しました。\n\n' + error + '\n\n' + targetTree);
    return null;
  }
};

// データベースからツリーのアーカイブ属性を取得する関数
export const loadIsArchivedFromDb = async (targetTree: UniqueIdentifier): Promise<boolean | undefined> => {
  try {
    const treeIsArchivedRef = ref(getDatabase(), `trees/${targetTree}/isArchived`);
    const snapshot = await get(treeIsArchivedRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return undefined;
    }
  } catch (error) {
    console.log('データベースからのツリーのアーカイブ属性の取得に失敗しました。\n\n' + error + '\n\n' + targetTree);
    return undefined;
  }
};

// データベースからツリーリストを取得する関数
export const loadTreesListFromDb = async (
  uid: string
): Promise<{ orderedTreesList: TreesList; missingTrees: UniqueIdentifier[] }> => {
  try {
    const userTreeListRef = ref(getDatabase(), `users/${uid}/treeList`);
    const snapshot = await get(userTreeListRef);
    if (snapshot.exists()) {
      let missingTrees: UniqueIdentifier[] = [];
      const data: string[] = snapshot.val();
      let treesListAccumulator: TreesList = [];
      // 反復してツリー名とアーカイブ属性をDBから取得
      const promises = data.map(async (treeId) => {
        const treeTitle = await loadTreeNameFromDb(treeId);
        const isArchived = await loadIsArchivedFromDb(treeId);
        if (treeTitle) {
          treesListAccumulator = [...treesListAccumulator, { id: treeId, name: treeTitle, isArchived: isArchived }];
        } else {
          missingTrees = missingTrees ? [...missingTrees, treeId] : [treeId];
        }
      });
      await Promise.all(promises);

      // DBの順序に基づいてtreesListAccumulatorを並び替え
      const orderedTreesList = data
        .map((treeId) => treesListAccumulator.find((t) => t.id === treeId))
        .filter((t): t is TreesListItem => t !== undefined);

      return { orderedTreesList, missingTrees };
    } else {
      return { orderedTreesList: [], missingTrees: [] };
    }
  } catch (error) {
    console.log('データベースからのtreesListの取得に失敗しました。\n\n' + error);
    return { orderedTreesList: [], missingTrees: [] };
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
    console.log('データベースからのitemsの取得に失敗しました。\n\n' + error);
    return null;
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
    console.log('データベースからのツリーメンバーの取得に失敗しました。\n\n' + error);
    return null;
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
            isArchived: treeData.isArchived,
            items: treeData.items,
          };
          return treeItemsIncludingItems;
        }
        console.log('ツリーデータが不正です。');
        return null;
      }
      return null;
    });
    const treeData = await Promise.all(promises);
    return treeData.filter((item) => item !== null);
  } catch (error) {
    console.log('データベースからのツリーデータの取得に失敗しました。\n\n' + error);
    return null;
  }
};

// データベースからAppStateを取得する関数
export const loadAppStateFromDb = async (uid: string): Promise<AppState | null> => {
  try {
    const appStateRef = ref(getDatabase(), `users/${uid}/settings`);
    const snapshot = await get(appStateRef);
    if (snapshot.exists()) {
      const data: AppState = snapshot.val();
      if (isValidAppSettingsState(data)) {
        return data;
      }
      console.log('データベースのアプリ設定が不正です。');
      return null;
    } else {
      return null;
    }
  } catch (error) {
    console.log('データベースからのAppStateの取得に失敗しました。\n\n' + error);
    return null;
  }
};

// データベースからクイックメモを取得する関数
export const loadQuickMemoFromDb = async (uid: string): Promise<string | null> => {
  try {
    const quickMemoRef = ref(getDatabase(), `users/${uid}/quickMemo`);
    const snapshot = await get(quickMemoRef);
    if (snapshot.exists()) {
      const data: string = snapshot.val();
      return data;
    } else {
      return null;
    }
  } catch (error) {
    console.log('データベースからのクイックメモの取得に失敗しました。\n\n' + error);
    return null;
  }
};

// データベースにAppStateを保存する関数
export const saveAppStateToDb = async (uid: string, darkModeNew: boolean, hideDoneItemsNew: boolean) => {
  try {
    const appStateRef = ref(getDatabase(), `users/${uid}/settings`);
    await set(appStateRef, { darkMode: darkModeNew, hideDoneItems: hideDoneItemsNew });
  } catch (error) {
    throw new Error('データベースへのAppStateの保存に失敗しました。\n\n' + error);
  }
};

// データベースにクイックメモを保存する関数
export const saveQuickMemoToDb = async (uid: string, quickMemoText: string) => {
  try {
    const quickMemoRef = ref(getDatabase(), `users/${uid}/quickMemo`);
    await set(quickMemoRef, quickMemoText);
  } catch (error) {
    throw new Error('データベースへのクイックメモの保存に失敗しました。\n\n' + error);
  }
};
