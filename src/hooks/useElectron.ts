import { useEffect } from 'react';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useTreeManagement } from '@/hooks/useTreeManagement';

const isElectron = navigator.userAgent.indexOf('Electron') >= 0;

export const useElectron = () => {
  const darkMode = useAppStateStore((state) => state.darkMode);
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);

  const { handleCreateNewTree, handleLoadedContent, handleDownloadTreeState, handleDownloadAllTrees, saveItems } = useTreeManagement();

  // 新規ツリー作成のイベントリスナーを登録
  useEffect(() => {
    if (!isElectron) return;

    window.electron.createNewTree(() => {
      handleCreateNewTree();
    });
    return () => {
      window.electron.removeCreateNewTreeListener(); // コンポーネントのアンマウント時にイベントリスナーを削除
    };
  }, [handleCreateNewTree]);

  // ツリーのインポートのイベントリスナーを登録
  useEffect(() => {
    if (!isElectron) return;

    const handleAsyncLoadedContent = async (data: string | null) => {
      await handleLoadedContent(data);
    };
    window.electron.onLoadedContent(handleAsyncLoadedContent);
    return () => {
      window.electron.removeLoadedContentListener();
    };
  }, [handleLoadedContent]);

  // ツリーの保存のイベントリスナーを登録
  useEffect(() => {
    if (!isElectron) return;

    window.electron.saveTree(async () => {
      await handleDownloadTreeState();
    });
    return () => {
      window.electron.removeSaveTreeListener();
    };
  }, [handleDownloadTreeState]);

  // 全ツリーの保存のイベントリスナーを登録
  useEffect(() => {
    if (!isElectron) return;

    window.electron.saveAllTrees(async () => {
      await handleDownloadAllTrees();
    });
    return () => {
      window.electron.removeSaveAllTreesListener();
    };
  }, [handleDownloadAllTrees]);

  // ダークモードの状態を監視し、変更があれば反映
  useEffect(() => {
    if (!isElectron) return;

    window.electron.setDarkMode(darkMode);
  }, [darkMode]);

  // ログイン状態によってメニューの有効無効を切り替える
  useEffect(() => {
    if (!isElectron) return;
    const currentTree = useTreeStateStore.getState().currentTree;

    window.electron.toggleMenuItem('create-new-tree', isLoggedIn);
    window.electron.toggleMenuItem('import-tree', isLoggedIn);
    if (!currentTree) {
      window.electron.toggleMenuItem('save-tree', false);
    } else {
      window.electron.toggleMenuItem('save-tree', isLoggedIn);
    }
    window.electron.toggleMenuItem('save-all-tree', isLoggedIn);
  }, [isLoggedIn]);

  // アプリ終了時に全ツリーを保存
  useEffect(() => {
    if (!isElectron) return;

    window.electron.onBeforeClose(async () => {
      try {
        const data = await handleDownloadAllTrees(true);
        if (data && typeof data === 'string') {
          window.electron.sendCloseCompleted(data);
        } else {
          window.electron.sendCloseCompleted('error');
        }
      } catch (error) {
        window.electron.sendCloseCompleted('error');
      }
    });

    return () => {
      window.electron.removeBeforeCloseListener();
    };
  }, [handleDownloadAllTrees]);

  // ログインしたらタイマーをセットしてデータをバックアップ
  useEffect(() => {
    if (!isElectron) return;

    if (isLoggedIn) {
      const asyncRun = async () => {
        const data = await handleDownloadAllTrees(true);
        if (data && typeof data === 'string') {
          window.electron.saveBackup(data);
        }
      };
      // ログインしてから10秒後にバックアップを作成
      const timer = setTimeout(asyncRun, 1000 * 10);

      // タイマーをセットして8時間ごとにバックアップを作成
      const timer2 = setInterval(
        async () => {
          const data = await handleDownloadAllTrees(true);
          if (data && typeof data === 'string') {
            window.electron.saveBackup(data);
          }
        },
        1000 * 60 * 60 * 8
      );
      return () => {
        clearTimeout(timer);
        clearInterval(timer2);
      };
    }
    return () => { };
  }, [isLoggedIn, handleDownloadAllTrees]);

  // アプリ終了時に現在のツリーを保存
  useEffect(() => {
    if (!isElectron) return;

    window.electron.saveLastTree(() => {
      const currentTree = useTreeStateStore.getState().currentTree;
      const items = useTreeStateStore.getState().items;
      if (currentTree) {
        saveItems(items, currentTree);
      }
    });

    return () => {
      window.electron.removeSaveLastTreeListener();
    };
  }, [saveItems]);
};