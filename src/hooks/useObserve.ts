import { useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { get } from 'firebase/database';
import { useTreeStateStore } from '../store/treeStateStore';
import { useTreeManagement } from './useTreeManagement';
import { useAppStateManagement } from './useAppStateManagement';
import { useDialogStore } from '../store/dialogStore';
import { useError } from './useError';
import { useDatabase } from './useDatabase';
import { useIndexedDb } from './useIndexedDb';
import { getDatabase, ref, onValue, } from 'firebase/database';
import { useAppStateStore } from '../store/appStateStore';
import { Preferences } from '@capacitor/preferences';

export const useObserve = () => {
  const isOffline = useAppStateStore((state) => state.isOffline);
  const uid = useAppStateStore((state) => state.uid);
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const isLoadedMemoFromDb = useAppStateStore((state) => state.isLoadedMemoFromDb);
  const setIsLoadedMemoFromDb = useAppStateStore((state) => state.setIsLoadedMemoFromDb);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const items = useTreeStateStore((state) => state.items);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);
  const prevItems = useTreeStateStore((state) => state.prevItems);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);
  const prevCurrentTree = useTreeStateStore((state) => state.prevCurrentTree);
  const setPrevCurrentTree = useTreeStateStore((state) => state.setPrevCurrentTree);

  const showDialog = useDialogStore((state) => state.showDialog);

  const { loadCurrentTreeData, handleLoadedContent } = useTreeManagement();
  const { loadTreesListFromDb, saveItemsDb } = useDatabase();
  const { syncDb,
    checkAndSyncDb,
    loadSettingsFromIdb,
    loadQuickMemoFromIdb,
    loadTreesListFromIdb,
    saveItemsIdb,
    saveTreesListIdb,
    saveQuickMemoIdb,
    copyTreeDataToIdbFromDb
  } = useIndexedDb();
  const { loadQuickMemoFromDb, saveQuickMemoDb } = useAppStateManagement();
  const { handleError } = useError();

  // サーバのタイムスタンプを監視 ------------------------------------------------
  const observeTimeStamp = async () => {
    if (!uid) {
      return;
    }
    if (!isLoading) setIsLoading(true);
    await checkAndSyncDb();
    await loadSettingsFromIdb();
    await loadTreesListFromIdb();
    await loadQuickMemoFromIdb();
    // ローカルストレージからitems_offlineとtreeName_offline、quick_memo_offlineを読み込む
    const { value: itemsOffline } = await Preferences.get({ key: `items_offline` });
    const { value: treeNameOffline } = await Preferences.get({ key: `treeName_offline` });
    const { value: quickMemoOffline } = await Preferences.get({ key: `quick_memo_offline` });
    if (itemsOffline) {
      const items = JSON.parse(itemsOffline);
      const name = treeNameOffline ? treeNameOffline : 'オフラインツリー';
      const quickMemo = quickMemoOffline ? quickMemoOffline : '';
      const conbinedQuickMemoText = quickMemoText + '\n\n' + quickMemo;
      const result = await showDialog('オフラインツリーが見つかりました。このツリーを読み込みますか？', 'オフラインツリーの読み込み', true);
      if (result) {
        await handleLoadedContent(JSON.stringify({ name, items }));
        setQuickMemoText(conbinedQuickMemoText);
        await Preferences.remove({ key: `items_offline` });
        await Preferences.remove({ key: `treeName_offline` });
        await Preferences.remove({ key: `quick_memo_offline` });
      } else {
        const removeResult = await showDialog('オフラインツリーを削除しますか？削除せず、次回ログイン時に読み込むこともできます。', 'オフラインツリーの削除', true);
        if (removeResult) {
          await Preferences.remove({ key: `items_offline` });
          await Preferences.remove({ key: `treeName_offline` });
          await Preferences.remove({ key: `quick_memo_offline` });
        }
      }
    }
    const timestampRef = ref(getDatabase(), `users/${uid}/timestamp`);
    onValue(timestampRef, async (snapshot) => {
      if (!isLoading) setIsLoading(true);
      const serverTimestamp = snapshot.val();
      const currentLocalTimestamp = useAppStateStore.getState().localTimestamp;
      if (serverTimestamp && serverTimestamp > currentLocalTimestamp) {
        setLocalTimestamp(serverTimestamp);
        const newTreesList = await loadTreesListFromDb(uid);
        setTreesList(newTreesList);
        await saveTreesListIdb(newTreesList);
        await loadQuickMemoFromDb();
        // treesListを反復して、タイムスタンプをチェックし、最新のツリーをコピー
        const treeIds = newTreesList.map((tree) => tree.id);
        let treeUpdateCount = 0;
        for (const treeId of treeIds) {
          const treeRef = ref(getDatabase(), `trees/${treeId}`);
          await get(treeRef).then(async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              if (data.timestamp > currentLocalTimestamp) {
                await copyTreeDataToIdbFromDb(treeId);
                treeUpdateCount++;
              }
            }
          });
        }
        if (treeUpdateCount == 0) {
          const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
          await get(timestampV2Ref).then(async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              if (data !== serverTimestamp) {
                await syncDb();
              }
            }
          });
        }
        const currentTree = useTreeStateStore.getState().currentTree;
        if (currentTree) {
          setPrevCurrentTree(null);
          setPrevItems([]);
          await loadCurrentTreeData(currentTree);
        }

      }
      setIsLoading(false);
    });
  };

  // ローカルitemsの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    if ((!uid && !isOffline) || !currentTree || isEqual(items, prevItems)) {
      return;
    }

    if (currentTree !== prevCurrentTree) {
      if (prevItems.length > 0) {
        const asyncFunc = async () => {
          if (prevCurrentTree) {
            await saveItemsIdb(prevItems, prevCurrentTree);
            await saveItemsDb(prevItems, prevCurrentTree);
          }
        }
        asyncFunc();
      }
      setPrevCurrentTree(currentTree);
      setPrevItems([]);
      return;
    }

    setPrevItems(items);
    const targetTree = currentTree;
    const debounceSave = setTimeout(() => {
      try {
        if (isOffline) {
          // オフラインモードの場合、ローカルストレージに保存
          Preferences.set({
            key: `items_offline`,
            value: JSON.stringify(items),
          });
          if (currentTreeName) {
            Preferences.set({
              key: `treeName_offline`,
              value: currentTreeName,
            });
          }
        } else {
          // オンラインモードの場合、データベースに保存
          const asyncFunc = async () => {
            await saveItemsIdb(items, targetTree);
            await saveItemsDb(items, targetTree);
          }
          asyncFunc();
        }
        setPrevItems([]);
      } catch (error) {
        handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
      }
    }, 5000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ローカルのクイックメモの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    if (!uid) {
      return;
    }
    if (isLoadedMemoFromDb) {
      setIsLoadedMemoFromDb(false);
      return;
    }
    const debounceSave = setTimeout(() => {
      try {
        if (isOffline) {
          // オフラインモードの場合、ローカルストレージに保存
          Preferences.set({
            key: `quick_memo_offline`,
            value: quickMemoText,
          });
        } else {
          const asyncFunc = async () => {
            await saveQuickMemoIdb(quickMemoText);
            await saveQuickMemoDb(quickMemoText);
          }
          asyncFunc();
        }
      } catch (error) {
        handleError('クイックメモの変更をデータベースに保存できませんでした。\n\n' + error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMemoText]);

  return {
    observeTimeStamp
  };
}