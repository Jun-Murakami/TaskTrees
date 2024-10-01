import { useCallback } from 'react';
import { getDatabase, ref, set } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureChildrenProperty, isTreeItemArray } from '@/features/sortableTree/utilities';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { useError } from '@/hooks/useError';
import * as dbService from '@/services/databaseService';
import * as idbService from '@/services/indexedDbService';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItems, TreesListItemIncludingItems, MemberItems } from '@/types/types';

export const useSync = () => {
  const { handleError } = useError();
  const { showDialog } = useDialogStore();
  // タイムスタンプをデータベースに保存する関数 ---------------------------------------------------------------------------
  const updateTimeStamp = useCallback(async (targetTree: UniqueIdentifier | null) => {
    const uid = useAppStateStore.getState().uid;
    const setLocalTimestamp = useAppStateStore.getState().setLocalTimestamp;
    const currentTreeMembers = useTreeStateStore.getState().currentTreeMembers;
    if (!uid) {
      return;
    }
    try {
      await new Promise(resolve => setTimeout(resolve, 200));

      const newTimestamp = Date.now();

      // ローカルのタイムスタンプを更新
      setLocalTimestamp(newTimestamp);

      // indexDBのタイムスタンプを更新
      await idbService.saveTimeStampToIdb(targetTree, newTimestamp);

      await dbService.saveTimeStampDb(uid, targetTree, currentTreeMembers, newTimestamp);
    } catch (error) {
      handleError('タイムスタンプの保存に失敗しました。\n\n' + error);
    }
  }, [handleError]);

  // ローカルタイムスタンプの読み込み
  const loadAndSetLocalTimeStamp = useCallback(async () => {
    try {
      const setLocalTimestamp = useAppStateStore.getState().setLocalTimestamp;
      const localTimestamp = await idbService.loadTimeStampFromIdb();
      if (localTimestamp) {
        setLocalTimestamp(localTimestamp);
      }
    } catch (error) {
      handleError('ローカルタイムスタンプの読み込みに失敗しました。\n\n' + error);
    }
  }, [handleError]);

  // FirebaseRealtimeDatabaseとIndexedデータベースを同期する ------------------------------------------------
  const syncDb = useCallback(async () => {
    const uid = useAppStateStore.getState().uid;
    const darkMode = useAppStateStore.getState().darkMode;
    const hideDoneItems = useAppStateStore.getState().hideDoneItems;
    const quickMemoText = useAppStateStore.getState().quickMemoText;
    const treesList = useTreeStateStore.getState().treesList;
    const setLocalTimestamp = useAppStateStore.getState().setLocalTimestamp;
    const localTimestamp = Date.now();
    if (!uid) {
      return;
    }
    try {
      setLocalTimestamp(localTimestamp);
      const settingsDb = await dbService.loadAppStateFromDb(uid);
      const quickMemoDb = await dbService.loadQuickMemoFromDb(uid);
      const { orderedTreesList: treesListFromDb } = await dbService.loadTreesListFromDb(uid);
      await idbService.initializeAppStateIdb(localTimestamp, quickMemoDb ?? quickMemoText, settingsDb?.darkMode ?? darkMode, settingsDb?.hideDoneItems ?? hideDoneItems, treesListFromDb ?? treesList);
      const allTreesData = await dbService.loadAllTreesDataFromDb(treesListFromDb ?? treesList);
      if (allTreesData) {
        await idbService.initializeTreeDataIdb();
        for (const treeData of allTreesData) {
          if (treeData.id === undefined || treeData.id === null || treeData.id === '' || treeData.name === undefined || treeData.name === null) {
            continue;
          }
          if (treeData.timestamp === undefined || treeData.timestamp === null) {
            const treeRef = ref(getDatabase(), `trees/${treeData.id}/timestamp`);
            await set(treeRef, localTimestamp).catch(async (error) => {
              if (error.code === 'PERMISSION_DENIED') {
                const updateTreeTimestamp = httpsCallable(getFunctions(), 'updateTreeTimestamp');
                await updateTreeTimestamp({ treeId: treeData.id, timestamp: localTimestamp });
              }
            });
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
              await idbService.saveTreeToIdb(treeData.id, treeData.name, treeData.members, membersV2, treeData.timestamp ?? localTimestamp, ensuredItems);
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
    } catch (error) {
      handleError(error);
    }
  }, [handleError, showDialog]);

  // データベースが空かどうかをチェックして、空の場合は初期データを同期 ------------------------------------------------
  const checkAndSyncDb = useCallback(async () => {
    if (!useAppStateStore.getState().uid) {
      return;
    }
    try {
      // データベースが空かどうかをチェック
      const isEmpty = await idbService.checkDbEmpty();
      if (isEmpty) {
        // データベースが空の場合、初期データを登録
        await syncDb();
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, syncDb]);

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
      isArchived: undefined,
      items: [],
    };
    // ツリーアイテムを取得
    try {
      const treeItems = await dbService.loadItemsFromDb(targetTree);
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
      const treeName = await dbService.loadTreeNameFromDb(targetTree);
      if (treeName) {
        treeData.name = treeName;
      } else {
        treeData.name = '';
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
      const treeMembers = await dbService.loadMembersFromDb(targetTree);
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

    // ツリーのアーカイブ属性を取得
    try {
      const isArchived = await dbService.loadIsArchivedFromDb(targetTree);
      if (isArchived) {
        treeData.isArchived = isArchived;
      }
    } catch (error) {
      await showDialog('ツリーのアーカイブ属性の取得に失敗しました。\n\n' + error, 'Error');
      return;
    }

    // タイムスタンプを取得
    try {
      const treeTimestamp = await dbService.loadTreeTimestampFromDb(targetTree);
      if (treeTimestamp) {
        treeData.timestamp = treeTimestamp;
      }
    } catch (error) {
      await showDialog('ツリータイムスタンプの取得に失敗しました。\n\n' + error, 'Error');
      return;
    }

    // Indexedデータベースに保存
    try {
      await idbService.saveTreeToIdb(targetTree, treeData.name, treeData.members ?? [], treeData.membersV2, treeData.timestamp ?? -1, treeData.items, treeData.isArchived);
    } catch (error) {
      await showDialog('Indexedデータベースへの保存に失敗しました。\n\n' + error, 'Error');
    }
  }, [showDialog]);

  return { updateTimeStamp, checkAndSyncDb, syncDb, copyTreeDataToIdbFromDb, loadAndSetLocalTimeStamp };
}