import { useCallback } from 'react';
import { indexedDb as idb } from '@/indexedDb';
import { UniqueIdentifier } from '@dnd-kit/core';
import type { TreeItems, TreesList, TreesListItemIncludingItems, MemberItems } from '@/types/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref, set } from 'firebase/database';
import { isTreeItemArray, validateTreeItems, ensureChildrenProperty } from '@/features/sortableTree/utilities';
import { useAppStateManagement } from '@/hooks/useAppStateManagement';
import { useDatabase } from '@/hooks/useDatabase';
import { useError } from '@/hooks/useError';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useDialogStore } from '@/store/dialogStore';


export const useIndexedDb = () => {
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const setIsLoadedMemoFromDb = useAppStateStore((state) => state.setIsLoadedMemoFromDb);
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const showDialog = useDialogStore((state) => state.showDialog);

  const { loadSettingsFromDb, loadQuickMemoFromDb } = useAppStateManagement();
  const {
    loadTreesListFromDb,
    loadTreeTimestampFromDb,
    loadAllTreesDataFromDb,
    loadTreeNameFromDb,
    loadMembersFromDb,
    loadItemsFromDb,
  } = useDatabase();
  const { handleError } = useError();

  // FirebaseRealtimeDatabaseとIndexedデータベースを同期する ------------------------------------------------
  const syncDb = useCallback(async () => {
    const uid = useAppStateStore.getState().uid;
    const darkMode = useAppStateStore.getState().darkMode;
    const hideDoneItems = useAppStateStore.getState().hideDoneItems;
    const quickMemoText = useAppStateStore.getState().quickMemoText;
    const localTimestamp = Date.now();
    if (!uid) {
      return;
    }
    try {
      setLocalTimestamp(localTimestamp);
      await loadSettingsFromDb();
      await loadQuickMemoFromDb();
      const treesListFromDb = await loadTreesListFromDb(uid);
      await idb.appstate.clear();
      await idb.appstate.put({
        id: 1,
        timestamp: localTimestamp,
        quickMemo: quickMemoText,
        settings: {
          darkMode: darkMode,
          hideDoneItems: hideDoneItems,
        },
        treesList: treesListFromDb,
      });
      const allTreesData = await loadAllTreesDataFromDb(treesListFromDb);
      if (allTreesData) {
        await idb.treestate.clear();
        for (const treeData of allTreesData) {
          if (treeData.timestamp === undefined || treeData.timestamp === null) {
            const treeTimestampRef = ref(getDatabase(), `trees/${treeData.id}/timestamp`);
            await set(treeTimestampRef, localTimestamp);
          }
          if (treeData.members) {
            const functions = getFunctions();
            const getUserEmails = httpsCallable(functions, 'getUserEmails');
            const uids = Object.keys(treeData.members);
            const result = await getUserEmails({ userIds: uids });
            const emails = (result.data as { emails: string[] }).emails;
            const membersV2: { [key: string]: string } = {};
            for (const [i, uid] of uids.entries()) {
              membersV2[uid] = emails[i];
            }
            const treeMembersV2Ref = ref(getDatabase(), `trees/${treeData.id}/membersV2`);
            await set(treeMembersV2Ref, membersV2);
            const ensuredItems = ensureChildrenProperty(treeData.items);
            if (ensuredItems && isTreeItemArray(ensuredItems)) {
              await idb.treestate.put({
                id: treeData.id,
                name: treeData.name,
                members: treeData.members,
                membersV2: membersV2,
                timestamp: treeData.timestamp,
                items: ensuredItems,
              });
            } else {
              await showDialog('データベースのツリーが正しくありません。 ' + treeData.name, 'Error');
            }
          }
        }
      }
      const timestaampRef = ref(getDatabase(), `users/${uid}/timestamp`);
      await set(timestaampRef, localTimestamp);
      const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
      await set(timestampV2Ref, localTimestamp);
      setTreesList(treesListFromDb);
    } catch (error) {
      handleError(error);
    }
  }, [loadSettingsFromDb, loadQuickMemoFromDb, loadTreesListFromDb, loadAllTreesDataFromDb, handleError, showDialog, setLocalTimestamp, setTreesList,]);

  // データベースが空かどうかをチェックして、空の場合は初期データを同期 ------------------------------------------------
  const checkAndSyncDb = useCallback(async () => {
    if (!useAppStateStore.getState().uid) {
      return;
    }
    try {
      // データベースが空かどうかをチェック
      const isEmpty = (await idb.appstate.count()) === 0;
      if (isEmpty) {
        // データベースが空の場合、初期データを登録
        await syncDb();
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, syncDb]);

  // IndexedデータベースからAppの設定を読み込む ------------------------------------------------
  const loadSettingsFromIdb = useCallback(async () => {
    if (!useAppStateStore.getState().uid) {
      return;
    }
    try {
      const appState = await idb.appstate.get(1);
      if (appState) {
        setIsLoadedMemoFromDb(true);
        setDarkMode(appState.settings.darkMode);
        setHideDoneItems(appState.settings.hideDoneItems);
        setLocalTimestamp(appState.timestamp);
      }
    } catch (error) {
      handleError(error);
    }
  }, [setIsLoadedMemoFromDb, setDarkMode, setHideDoneItems, setLocalTimestamp, handleError]);

  // Indexedデータベースからダークモードの設定を読み込む ------------------------------------------------
  const loadDarkModeFromIdb = useCallback(async () => {
    try {
      const appState = await idb.appstate.get(1);
      if (appState) {
        return appState.settings.darkMode;
      }
    } catch (error) {
      console.error('Failed to load dark mode from IndexedDB', error);
      return false;
    }
    return false; // デフォルト値
  }, []);

  // Indexedデータベースからクイックメモを読み込む ------------------------------------------------
  const loadQuickMemoFromIdb = useCallback(async () => {
    if (!useAppStateStore.getState().uid) {
      return;
    }
    try {
      const appState = await idb.appstate.get(1);
      if (appState) {
        setIsLoadedMemoFromDb(true);
        setQuickMemoText(appState.quickMemo);
      }
    } catch (error) {
      handleError(error);
    }
  }, [setIsLoadedMemoFromDb, setQuickMemoText, handleError]);

  // Indexedデータベースからツリーリストを読み込む ------------------------------------------------
  const loadTreesListFromIdb = useCallback(async () => {
    if (!useAppStateStore.getState().uid) {
      return;
    }
    try {
      const appState = await idb.appstate.get(1);
      if (appState) {
        setTreesList(appState.treesList);
      }
    } catch (error) {
      handleError(error);
    }
  }, [setTreesList, handleError]);

  // Indexedデータベースから指定されたツリーのデータを読み込む ------------------------------------------------
  const loadCurrentTreeDataFromIdb = useCallback(async (targetTree: UniqueIdentifier) => {
    if (!useAppStateStore.getState().uid || !targetTree) {
      return;
    }
    try {
      const treeData = await idb.treestate.get(targetTree);
      if (treeData) {
        const ensuredItems = ensureChildrenProperty(treeData.items);
        const ensuredTreeData = { ...treeData, items: ensuredItems };
        return ensuredTreeData;
      } else {
        return null;
      }
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [handleError]);

  // Indexedデータベースに設定を保存 ------------------------------------------------
  const saveSettingsIdb = useCallback(async (darkMode: boolean, hideDoneItems: boolean) => {
    try {
      await idb.appstate.update(1, { settings: { darkMode, hideDoneItems } });
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  // IndexedデータベースにItemsを保存 ------------------------------------------------
  const saveItemsIdb = useCallback(async (newItems: TreeItems, targetTree: UniqueIdentifier) => {
    if (!useAppStateStore.getState().uid || !targetTree || !newItems) {
      return;
    }
    try {
      // newItemsの内容をチェック
      if (!isTreeItemArray(newItems)) {
        return;
      }

      // newItemsの内容を詳細にチェック
      const result = validateTreeItems(newItems);
      if (result !== '') {
        return;
      }

      const treeData = await idb.treestate.get(targetTree);
      if (treeData) {
        treeData.items = newItems;
        treeData.timestamp = Date.now();
        await idb.treestate.put(treeData);
      } else {
        await showDialog('ローカルデータベースのツリーが見つかりませんでした。', 'Error');
        return;
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, showDialog]);

  // Indexedデータベースにツリーリストを保存 ------------------------------------------------
  const saveTreesListIdb = useCallback(async (newTreesList: TreesList) => {
    try {
      await idb.appstate.update(1, { treesList: newTreesList });
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  // Indexedデータベースに現在のツリー名を保存 ------------------------------------------------
  const saveCurrentTreeNameIdb = useCallback(async (editedTreeName: string, targetTree: UniqueIdentifier | null) => {
    if (!useAppStateStore.getState().uid || !targetTree || !editedTreeName) {
      return;
    }
    try {
      const treeData = await idb.treestate.get(targetTree);
      if (treeData) {
        treeData.name = editedTreeName;
        treeData.timestamp = Date.now();
        await idb.treestate.put(treeData);
      } else {
        await showDialog('ローカルデータベースのツリーが見つかりませんでした。', 'Error');
        return;
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, showDialog]);

  // Indexedデータベースにクイックメモを保存 ------------------------------------------------
  const saveQuickMemoIdb = useCallback(async (quickMemoText: string) => {
    try {
      await idb.appstate.update(1, { quickMemo: quickMemoText });
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  // Indexedデータベースにメンバーを追加 ------------------------------------------------
  const updateMembersIdb = useCallback(async (targetTree: UniqueIdentifier, newMembers: { uid: string; email: string }[]) => {
    if (!useAppStateStore.getState().uid || !targetTree || !newMembers) {
      return;
    }
    try {
      const treeData = await idb.treestate.get(targetTree);
      if (treeData) {
        const members: string[] = [];
        const membersV2: { [key: string]: string } = {};
        newMembers.forEach((member) => {
          members.push(member.uid);
          membersV2[member.uid] = member.email;
        });
        treeData.members = members;
        treeData.membersV2 = membersV2;
        treeData.timestamp = Date.now();
        await idb.treestate.put(treeData);
      } else {
        await showDialog('ローカルデータベースのツリーが見つかりませんでした。', 'Error');
        return;
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, showDialog]);

  // Indexedデータベースからユーザーを削除 ------------------------------------------------
  const deleteMemberIdb = useCallback(async (targetTree: UniqueIdentifier, targetUid: string) => {
    if (!useAppStateStore.getState().uid || !targetTree || !targetUid) {
      return;
    }
    try {
      const treeData = await idb.treestate.get(targetTree);
      if (treeData && treeData.members && treeData.membersV2) {
        const index = treeData.members.indexOf(targetUid);
        if (index !== -1) {
          treeData.members.splice(index, 1);
        }
        delete treeData.membersV2[targetUid];
        treeData.timestamp = Date.now();
        await idb.treestate.put(treeData);
      } else {
        await showDialog('ローカルデータベースのツリーが見つかりませんでした。', 'Error');
        return;
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, showDialog]);

  // Indexedデータベースから指定されたツリーを削除 ------------------------------------------------
  const deleteTreeIdb = useCallback(async (targetTree: UniqueIdentifier) => {
    if (!useAppStateStore.getState().uid || !targetTree) {
      return;
    }
    try {
      await idb.treestate.delete(targetTree);
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  // 指定されたツリーのデータをIndexedデータベースに保存 ------------------------------------------------
  const copyTreeDataToIdbFromDb = useCallback(async (targetTree: UniqueIdentifier) => {
    if (!useAppStateStore.getState().uid || !targetTree) {
      return;
    }
    const treeData: TreesListItemIncludingItems = {
      id: targetTree,
      name: '',
      members: [],
      membersV2: {},
      timestamp: -1,
      items: [],
    };
    // ツリーアイテムを取得
    try {
      const treeItems = await loadItemsFromDb(targetTree);
      if (treeItems) {
        const data: TreeItems = treeItems;
        const itemsWithChildren = ensureChildrenProperty(data);
        if (isTreeItemArray(itemsWithChildren)) {
          treeData.items = itemsWithChildren;
        } else {
          throw new Error('取得したデータがTreeItem[]型ではありません。');
        }
      } else {
        treeData.items = [];
      }
    } catch (error) {
      await showDialog('ツリーアイテムの取得に失敗しました。\n\n' + error, 'Error');
      return;
    }

    // ツリー名を取得
    try {
      const treeName = await loadTreeNameFromDb(targetTree);
      if (treeName) {
        treeData.name = treeName;
      } else {
        treeData.name = undefined;
      }
    } catch (error) {
      await showDialog('ツリー名の取得に失敗しました。\n\n' + error, 'Error');
      return;
    }

    // メンバーリストからメールアドレスリストを取得するFirebase関数
    const getMemberEmails = async (memberList: string[]) => {
      const functions = getFunctions();
      const getUserEmails = httpsCallable(functions, 'getUserEmails');

      try {
        const result = await getUserEmails({ userIds: memberList });
        // レスポンスの処理
        const emails = (result.data as { emails: string[] }).emails;
        return emails; // ここでemailsを返す
      } catch (error) {
        await showDialog('メンバーのメールアドレスの取得に失敗しました。\n\n' + error, 'Error');
        return []; // エラーが発生した場合は空の配列を返す
      }
    };

    // ツリーメンバーを取得
    try {
      const treeMembers = await loadMembersFromDb(targetTree);
      if (treeMembers) {
        const membersObject = treeMembers;
        const uids = Object.keys(membersObject); // UIDのリストを取得

        // UIDリストを使用して、メールアドレスを取得
        const emails = await getMemberEmails(uids);
        // メンバーリストとメールアドレスを組み合わせてオブジェクトの配列を作成
        const membersWithEmails: MemberItems = {};
        for (const [i, uid] of uids.entries()) {
          membersWithEmails[uid] = emails[i];
        }
        treeData.membersV2 = membersWithEmails;
      } else {
        treeData.membersV2 = {};
      }
    } catch (error) {
      await showDialog('ツリーメンバーの取得に失敗しました。\n\n' + error, 'Error');
      return;
    }

    // タイムスタンプを取得
    try {
      const treeTimestamp = await loadTreeTimestampFromDb(targetTree);
      if (treeTimestamp) {
        treeData.timestamp = treeTimestamp;
      }
    } catch (error) {
      await showDialog('ツリータイムスタンプの取得に失敗しました。\n\n' + error, 'Error');
      return;
    }

    // Indexedデータベースに保存
    try {
      await idb.treestate.put(treeData);
    } catch (error) {
      await showDialog('Indexedデータベースへの保存に失敗しました。\n\n' + error, 'Error');
    }
  }, [showDialog, loadItemsFromDb, loadTreeNameFromDb, loadMembersFromDb, loadTreeTimestampFromDb]);

  return {
    syncDb,
    checkAndSyncDb,
    loadSettingsFromIdb,
    loadDarkModeFromIdb,
    loadQuickMemoFromIdb,
    loadTreesListFromIdb,
    loadCurrentTreeDataFromIdb,
    saveSettingsIdb,
    saveItemsIdb,
    saveTreesListIdb,
    saveCurrentTreeNameIdb,
    saveQuickMemoIdb,
    updateMembersIdb,
    deleteMemberIdb,
    deleteTreeIdb,
    copyTreeDataToIdbFromDb,
  };
};
