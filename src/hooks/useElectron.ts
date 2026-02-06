import { useEffect } from 'react';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useTreeManagement } from '@/hooks/useTreeManagement';

const isElectron = navigator.userAgent.includes('Electron');

export const useElectron = () => {
  const darkMode = useAppStateStore((state) => state.darkMode);
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);

  const { handleCreateNewTree, handleLoadedContent, handleDownloadTreeState, handleDownloadAllTrees, saveItems } = useTreeManagement();

  useEffect(() => {
    if (!isElectron || !isLoggedIn) return;

    window.electron?.createNewTree(() => {
      handleCreateNewTree();
    });
    return () => {
      window.electron?.removeCreateNewTreeListener();
    };
  }, [handleCreateNewTree, isLoggedIn]);

  useEffect(() => {
    if (!isElectron || !isLoggedIn) return;

    const handleAsyncLoadedContent = async (data: string | null) => {
      await handleLoadedContent(data);
    };
    window.electron?.onLoadedContent(handleAsyncLoadedContent);
    return () => {
      window.electron?.removeLoadedContentListener();
    };
  }, [handleLoadedContent, isLoggedIn]);

  useEffect(() => {
    if (!isElectron || !isLoggedIn) return;

    window.electron?.saveTree(async () => {
      await handleDownloadTreeState();
    });
    return () => {
      window.electron?.removeSaveTreeListener();
    };
  }, [handleDownloadTreeState, isLoggedIn]);

  useEffect(() => {
    if (!isElectron || !isLoggedIn) return;

    window.electron?.saveAllTrees(async () => {
      await handleDownloadAllTrees();
    });
    return () => {
      window.electron?.removeSaveAllTreesListener();
    };
  }, [handleDownloadAllTrees, isLoggedIn]);

  useEffect(() => {
    if (!isElectron) return;

    window.electron?.setDarkMode(darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!isElectron) return;
    const currentTree = useTreeStateStore.getState().currentTree;

    window.electron?.toggleMenuItem('create-new-tree', isLoggedIn);
    window.electron?.toggleMenuItem('import-tree', isLoggedIn);
    if (!currentTree) {
      window.electron?.toggleMenuItem('save-tree', false);
    } else {
      window.electron?.toggleMenuItem('save-tree', isLoggedIn);
    }
    window.electron?.toggleMenuItem('save-all-tree', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isElectron) return;

    window.electron?.onBeforeClose(async () => {
      try {
        if (!isLoggedIn) {
          window.electron?.sendCloseCompleted('error');
          return;
        }
        const data = await handleDownloadAllTrees(true);
        if (data && typeof data === 'string') {
          window.electron?.sendCloseCompleted(data);
        } else {
          window.electron?.sendCloseCompleted('error');
        }
      } catch (error) {
        console.error(error);
        window.electron?.sendCloseCompleted('error');
      }
    });

    return () => {
      window.electron?.removeBeforeCloseListener();
    };
  }, [handleDownloadAllTrees, isLoggedIn]);

  useEffect(() => {
    if (!isElectron) return;

    if (isLoggedIn) {
      const asyncRun = async () => {
        const data = await handleDownloadAllTrees(true);
        if (data && typeof data === 'string') {
          window.electron?.saveBackup(data);
        }
      };
      const timer = setTimeout(asyncRun, 1000 * 10);

      const timer2 = setInterval(
        async () => {
          const data = await handleDownloadAllTrees(true);
          if (data && typeof data === 'string') {
            window.electron?.saveBackup(data);
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

  useEffect(() => {
    if (!isElectron || !isLoggedIn) return;

    window.electron?.saveLastTree(async () => {
      const currentTree = useTreeStateStore.getState().currentTree;
      const items = useTreeStateStore.getState().items;
      if (currentTree) {
        await saveItems(items, currentTree);
      }
    });

    return () => {
      window.electron?.removeSaveLastTreeListener();
    };
  }, [saveItems, isLoggedIn]);
};
