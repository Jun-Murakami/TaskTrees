import { useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { useTreeStateStore } from '../store/treeStateStore';
import { useTreeManagement } from './useTreeManagement';
import { useAppStateManagement } from './useAppStateManagement';
import { useDialogStore } from '../store/dialogStore';
import { useError } from './useError';
import { useDatabase } from './useDatabase';
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
  const items = useTreeStateStore((state) => state.items);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);
  const prevItems = useTreeStateStore((state) => state.prevItems);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);

  const showDialog = useDialogStore((state) => state.showDialog);

  const { loadTreesList, loadCurrentTreeData, handleLoadedContent } = useTreeManagement();
  const { saveItemsDb, saveTimeStampDb } = useDatabase();
  const { loadSettingsFromDb, loadQuickMemoFromDb, saveQuickMemoDb } = useAppStateManagement();
  const { handleError } = useError();

  // サーバのタイムスタンプを監視 ------------------------------------------------
  const observeTimeStamp = async () => {
    if (!uid) {
      return;
    }
    if (!isLoading) setIsLoading(true);
    await loadSettingsFromDb();
    await loadTreesList();
    await loadQuickMemoFromDb();
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
        await loadSettingsFromDb();
        await loadTreesList();
        await loadQuickMemoFromDb();
        const currentTree = useTreeStateStore.getState().currentTree;
        if (currentTree) {
          await loadCurrentTreeData(currentTree);
        }

      }
      setIsLoading(false);
    });
  };

  // ローカルitemsの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    // ツリー変更時には前回のitemsを保存して終了
    if (prevItems.length === 0) {
      setPrevItems(items);
      return;
    }
    if ((!uid && !isOffline) || !currentTree || isEqual(items, prevItems)) {
      return;
    }
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
          saveItemsDb(items, currentTree);
        }
        setPrevItems(items);
      } catch (error) {
        handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ローカルのクイックメモの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    if (!uid || !quickMemoText) {
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
          saveTimeStampDb();
          saveQuickMemoDb(quickMemoText);
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