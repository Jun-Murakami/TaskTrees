import { useCallback } from 'react';
import { isValidAppSettingsState } from '@/features/sortableTree/utilities';
import { useSync } from '@/hooks/useSync';
import * as dbService from '@/services/databaseService';
import * as idbService from '@/services/indexedDbService';
import { useAppStateStore } from '@/store/appStateStore';
import { useError } from '@/hooks/useError';

export const useAppStateManagement = () => {
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const setIsLoadedMemoFromDb = useAppStateStore((state) => state.setIsLoadedMemoFromDb);

  const { updateTimeStamp } = useSync();
  // エラーハンドリング
  const { handleError } = useError();

  // Firebaseからダークモード、完了済みアイテムの非表示設定を取得してIndexedDBに保存 ------------------------------------------------
  const loadAndSetSettingsFromDb = useCallback(async ({ saveToIdb }: { saveToIdb: boolean }) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      const data = await dbService.loadAppStateFromDb(uid);
      if (data) {
        if (isValidAppSettingsState(data)) {
          if (saveToIdb) {
            await idbService.saveAppStateToIdb(data.darkMode, data.hideDoneItems);
          }
          setDarkMode(data.darkMode);
          setHideDoneItems(data.hideDoneItems);
        }
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setDarkMode, setHideDoneItems]);

  // Firebaseからクイックメモを取得してIndexedDBに保存 ------------------------------------------------
  const loadAndSetQuickMemoFromDb = useCallback(async ({ saveToIdb }: { saveToIdb: boolean }) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      const quickMemo = await dbService.loadQuickMemoFromDb(uid);
      if (!quickMemo) {
        return;
      }
      if (saveToIdb) {
        await idbService.saveQuickMemoToIdb(quickMemo);
      }
      setIsLoadedMemoFromDb(true);
      setQuickMemoText(quickMemo);
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setIsLoadedMemoFromDb, setQuickMemoText]);

  // IndexedDBからクイックメモを取得 ------------------------------------------------
  const loadAndSetQuickMemoFromIdb = useCallback(async () => {
    try {
      const quickMemo = await idbService.loadQuickMemoFromIdb();
      if (quickMemo) {
        setIsLoadedMemoFromDb(true);
        setQuickMemoText(quickMemo);
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setIsLoadedMemoFromDb, setQuickMemoText]);

  // IndexedDBからダークモードと完了済みアイテムの非表示設定を取得 ------------------------------------------------
  const loadAppSettingsFromIdb = useCallback(async () => {
    try {
      const appState = await idbService.loadAppStateFromIdb();
      if (appState) {
        setDarkMode(appState.settings.darkMode);
        setHideDoneItems(appState.settings.hideDoneItems);
      }
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setDarkMode, setHideDoneItems]);

  // ダークモードと完了済みアイテムの非表示設定を保存 ------------------------------------------------
  const saveAppSettings = useCallback(async (darkModeNew: boolean, hideDoneItemsNew: boolean) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      await dbService.saveAppStateToDb(uid, darkModeNew, hideDoneItemsNew);
      await idbService.saveAppStateToIdb(darkModeNew, hideDoneItemsNew);
      await updateTimeStamp(null);
    } catch (error) {
      handleError(error);
    }
  }, [handleError, updateTimeStamp]);

  // クイックメモをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveQuickMemo = useCallback(async (quickMemoText: string) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      await dbService.saveQuickMemoToDb(uid, quickMemoText);
      await idbService.saveQuickMemoToIdb(quickMemoText);
      await updateTimeStamp(null);
    } catch (error) {
      handleError('クイックメモの変更をデータベースに保存できませんでした。\n\n' + error);
    }
  }, [handleError, updateTimeStamp]);

  return { loadAndSetSettingsFromDb, loadAndSetQuickMemoFromDb, loadAndSetQuickMemoFromIdb, saveAppSettings, saveQuickMemo, loadAppSettingsFromIdb };
};
