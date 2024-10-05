import { useCallback } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList, TreesListItemIncludingItems, TreeItems } from '@/types/types';
import { isTreeItemArray, validateTreeItems } from '@/features/sortableTree/utilities';
import { initialItems, initialOfflineItems } from '@/features/sortableTree/mock';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useAttachedFile } from '@/features/sortableTree/hooks/useAttachedFile';
import { useSync } from '@/hooks/useSync';
import * as dbService from '@/services/databaseService';
import * as idbService from '@/services/indexedDbService';
import { useDialogStore, useInputDialogStore } from '@/store/dialogStore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';

// ツリーの管理に関するカスタムフック
// データベースに関連する処理はuseDatabaseフックを使用

export const useTreeManagement = () => {
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const setIsAccordionExpanded = useAppStateStore((state) => state.setIsAccordionExpanded);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);

  const setItems = useTreeStateStore((state) => state.setItems);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);
  const setCurrentTreeIsArchived = useTreeStateStore((state) => state.setCurrentTreeIsArchived);

  const showDialog = useDialogStore((state) => state.showDialog);
  const showInputDialog = useInputDialogStore((state) => state.showDialog);

  const { updateTimeStamp, copyTreeDataToIdbFromDb } = useSync();
  const { deleteFile } = useAttachedFile();

  // itemsを保存する関数 ---------------------------------------------------------------------------
  const saveItems = useCallback(async (newItems: TreeItems, targetTree: UniqueIdentifier) => {
    const uid = useAppStateStore.getState().uid;
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

      await dbService.saveItemsDb(targetTree, newItems);
      await idbService.saveItemsToIdb(targetTree, newItems);
      await updateTimeStamp(targetTree);
    } catch (error) {
      await showDialog('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error, 'Error');
    }
  }, [showDialog, updateTimeStamp]);

  // ツリーリストをFirebaseから読み込む---------------------------------------------------------------------------
  const loadAndSetTreesListFromDb = useCallback(async ({ saveToIdb }: { saveToIdb: boolean }) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      const { orderedTreesList, missingTrees } = await dbService.loadTreesListFromDb(uid);
      if (missingTrees.length > 0) {
        await showDialog('１つ以上のツリーが削除されたか、アクセス権限が変更されました。\n\n' + missingTrees.join('\n'), 'Information');
      }
      if (saveToIdb) {
        await idbService.saveTreesListToIdb(orderedTreesList);
      }
      setTreesList(orderedTreesList);
      return orderedTreesList;
    } catch (error) {
      await showDialog('ツリーリストの取得に失敗しました。\n\n' + error, 'Error');
    }
  }, [showDialog, setTreesList]);

  // ツリーリストをIndexedDBから読み込む---------------------------------------------------------------------------
  const loadAndSetTreesListFromIdb = useCallback(async () => {
    try {
      const treesList = await idbService.loadTreesListFromIdb();
      if (treesList) {
        setTreesList(treesList);
      }
    } catch (error) {
      await showDialog('ツリーリストの取得に失敗しました。\n\n' + error, 'Error');
    }
  }, [showDialog, setTreesList]);

  // ツリーリストを保存する関数 ---------------------------------------------------------------------------
  const handleSaveTreesList = useCallback(async (treesList: TreesList) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!uid || (!isConnectedDb && !isOffline)) {
      return;
    }
    try {
      await idbService.saveTreesListToIdb(treesList)
      await dbService.saveTreesListDb(uid, treesList);
      await updateTimeStamp(null);
    } catch (error) {
      await showDialog('ツリーリストの保存に失敗しました。\n\n' + error, 'Error');
    }
  }, [showDialog, updateTimeStamp]);

  // ターゲットIDのitems、name、membersをIndexedDBからロードする ---------------------------------------------------------------------------
  const loadAndSetCurrentTreeDataFromIdb = useCallback(async (targetTree: UniqueIdentifier) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      const treeData = await idbService.loadCurrentTreeDataFromIdb(targetTree);
      if (treeData && treeData.name && treeData.membersV2 && treeData.items) {
        setCurrentTreeName(treeData.name);
        const members: { uid: string; email: string }[] = [];
        for (const member in treeData.membersV2) {
          members.push({ uid: member, email: treeData.membersV2[member] });
        }
        setCurrentTreeMembers(members);
        if (treeData.isArchived) {
          setCurrentTreeIsArchived(true);
        } else {
          setCurrentTreeIsArchived(false);
        }
        setItems(treeData.items);
      }

    } catch (error) {
      await showDialog('ツリーのデータの取得に失敗しました。\n\n' + error, 'Error');
    }
  }, [showDialog, setCurrentTreeName, setCurrentTreeMembers, setItems, setCurrentTreeIsArchived]);

  //ツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTree = useCallback(async (targetTree: UniqueIdentifier) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const items = useTreeStateStore.getState().items;
    const treesList = useTreeStateStore.getState().treesList;
    const currentTree = useTreeStateStore.getState().currentTree;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!uid || (!isConnectedDb && !isOffline)) {
      return;
    }

    // ツリーを削除する前に現在のツリー内の子要素を含むすべてのattachedFileを再帰的に削除
    const deleteAttachedFiles = async () => {
      const deleteAttachedFilesRecursively = async (items: TreeItem[]) => {
        for (const item of items) {
          if (item.attachedFile) {
            if (currentTree) {
              await deleteFile(item.attachedFile, currentTree, true);
            }
          }
          if (item.children) {
            await deleteAttachedFilesRecursively(item.children);
          }
        }
      };
      await deleteAttachedFilesRecursively(items);
    };
    await deleteAttachedFiles();

    try {
      await dbService.deleteTreeFromDb(targetTree);
      await idbService.deleteTreeFromIdb(targetTree);
      const updatedTreesList = treesList ? treesList.filter((tree) => tree.id !== targetTree) : [];
      setTreesList(updatedTreesList);
      await dbService.saveTreesListDb(uid, updatedTreesList);
      await idbService.saveTreesListToIdb(updatedTreesList);

      await updateTimeStamp(null);

      setCurrentTree(null);
      setCurrentTreeName(null);
      setCurrentTreeMembers(null);
      setItems([]);
      setIsAccordionExpanded(false);

    } catch (error) {
      await showDialog('ツリーの削除に失敗しました。\n\n' + error, 'Error');
    }
  }, [deleteFile, showDialog, setTreesList, updateTimeStamp, setCurrentTree, setCurrentTreeName, setCurrentTreeMembers, setItems, setIsAccordionExpanded]);

  // ダイアログ付きで呼び出す場合
  const handleDeleteTree = useCallback(async () => {
    const currentTree = useTreeStateStore.getState().currentTree;
    const result = await showDialog(
      'すべての編集メンバーからツリーが削除されます。この操作は元に戻せません。実行しますか？',
      'Confirmation Required',
      true
    );
    if (result) {
      await deleteTree(currentTree as UniqueIdentifier);
    }
  }, [deleteTree, showDialog]);

  // 新しいツリーを作成する ---------------------------------------------------------------------------
  // サーバに新しいツリーを保存する
  const saveNewTree = useCallback(
    async (items: TreeItem[], name: string, members: { [key: string]: boolean }) => {
      const functions = getFunctions();
      const createNewTree = httpsCallable(functions, 'createNewTree');

      try {
        const result = await createNewTree({
          items: items.map((item) => ({
            id: item.id.toString(), // idをstringにキャスト
            children: item.children, // childrenは再帰的に同様に処理する必要がある場合があります
            value: item.value,
            collapsed: item.collapsed,
            done: item.done,
          })),
          name: name,
          members: members,
        });
        const treeId: string = result.data as string; // result.dataをstring型としてキャスト
        return treeId;
      } catch (error) {
        await showDialog('ツリーの作成に失敗しました。\n\n' + error, 'Error');
        return []; // エラーが発生した場合は空の配列を返す
      }
    }, [showDialog]);

  // ハンドラから呼び出し
  const handleCreateNewTree = useCallback(async () => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const treesList = useTreeStateStore.getState().treesList;
    const email = useAppStateStore.getState().email;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (isOffline) {
      await showDialog('オフラインモードでは新しいツリーを作成できません。', 'Information');
    }
    if (!uid || (!isConnectedDb && !isOffline)) {
      return Promise.reject();
    }

    setCurrentTree(null);
    setIsLoading(true);

    try {
      const newTreeRef: unknown = await saveNewTree(initialItems, '新しいツリー', {
        [uid]: true,
      });
      if (!newTreeRef) {
        throw new Error('新しいツリーの作成に失敗しました。');
      }

      const newTree = { id: newTreeRef as UniqueIdentifier, name: '新しいツリー' };
      const updatedTreesListWithNewTree = treesList ? [...treesList, newTree] : [newTree];
      setTreesList(updatedTreesListWithNewTree);

      await idbService.saveTreesListToIdb(updatedTreesListWithNewTree);
      await dbService.saveTreesListDb(uid, updatedTreesListWithNewTree);
      await copyTreeDataToIdbFromDb(newTreeRef as UniqueIdentifier);
      await loadAndSetCurrentTreeDataFromIdb(newTreeRef as UniqueIdentifier);
      await loadAndSetTreesListFromIdb();
      await updateTimeStamp(newTreeRef as UniqueIdentifier);

      setIsAccordionExpanded(true);
      // 0.5秒後にフォーカスをセット
      setCurrentTree(newTreeRef as UniqueIdentifier);
      setCurrentTreeName('新しいツリー');
      if (email) {
        setCurrentTreeMembers([{ uid: uid, email: email }]);
      } else {
        setCurrentTreeMembers([{ uid: uid, email: 'unknown' }]);
      }

      const timerOne = setTimeout(() => {
        setIsFocusedTreeName(true);
      }, 300);

      setIsLoading(false);

      //タイマーをクリア
      return () => {
        clearTimeout(timerOne);
        Promise.resolve();
      };
    } catch (error) {
      await showDialog('新しいツリーの作成に失敗しました。\n\n' + error, 'Error');
      setIsLoading(false);
      return Promise.reject();
    }
  }, [
    showDialog,
    saveNewTree,
    setCurrentTree,
    setIsLoading,
    setCurrentTreeName,
    setCurrentTreeMembers,
    setIsAccordionExpanded,
    copyTreeDataToIdbFromDb,
    loadAndSetCurrentTreeDataFromIdb,
    loadAndSetTreesListFromIdb,
    updateTimeStamp,
    setIsFocusedTreeName,
    setTreesList,
  ]);

  //オフラインツリーを作成する ---------------------------------------------------------------------------
  const handleCreateOfflineTree = useCallback(async () => {
    setIsLoading(true);
    try {
      setCurrentTree('offline');
      const { value: treeName } = await Preferences.get({ key: `treeName_offline` });
      if (treeName) {
        // ローカルストレージから読み込んだデータが存在する場合
        setCurrentTreeName(treeName);
      } else {
        // ローカルストレージにデータが存在しない場合、初期のツリー名をセット
        setCurrentTreeName('オフラインツリー');
      }
      setCurrentTreeMembers([{ uid: 'offline', email: 'offline' }]);
      setTreesList([{ id: 'offline' as UniqueIdentifier, name: 'オフラインツリー' }]);
      const { value } = await Preferences.get({ key: `items_offline` });
      if (value) {
        // ローカルストレージから読み込んだデータが存在する場合
        const items = JSON.parse(value);
        setItems(items);
      } else {
        // ローカルストレージにデータが存在しない場合、初期のオフラインアイテムをセット
        setItems(initialOfflineItems);
      }
    } catch (error) {
      console.error('ローカルストレージからの読み込みに失敗しました', error);
      // エラーが発生した場合は初期のオフラインアイテムをセット
      setItems(initialOfflineItems);
    }
    setIsLoading(false);
  }, [
    setIsLoading,
    setCurrentTree,
    setCurrentTreeName,
    setCurrentTreeMembers,
    setTreesList,
    setItems,
  ]);

  // ファイルを読み込んでツリーの状態を復元する ---------------------------------------------------------------------------

  // データがTreesListItemIncludingItems[]型であることを確認する関数
  const isValidTreeListItemIncludingItems = (arg: unknown): arg is TreesListItemIncludingItems[] => {
    return (
      Array.isArray(arg) &&
      arg.every((item) => item !== null && 'id' in item && 'name' in item && 'members' in item && 'items' in item)
    );
  };

  // ツリーの状態をチェックする関数
  const isValidTreeState = (treeState: TreesListItemIncludingItems) => {
    if (!treeState.items) {
      return false;
    }
    // itemsがTreeItems型であることを確認
    if (!isTreeItemArray(treeState.items)) {
      console.log('itemsがTreeItems型ではありません。');
      return false;
    }
    return true;
  };

  // 本編
  const handleLoadedContent = useCallback(async (data: string | null) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const email = useAppStateStore.getState().email;
    const isLoading = useAppStateStore.getState().isLoading;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!uid || (!isConnectedDb && !isOffline)) {
      return Promise.reject();
    }
    const treesList = useTreeStateStore.getState().treesList;
    if (data) {
      try {
        setCurrentTree(null);
        const treeStateWithAttachedDFiles = JSON.parse(data as string);
        // 子要素を含めたすべてのattachedFileをtreeStateから除外したリストを取得
        const deleteAttachedFilesState = (treeState: TreesListItemIncludingItems) => {
          const deleteAttachedFilesRecursively = (items: TreeItem[]) => {
            for (const item of items) {
              if (item.attachedFile) {
                item.attachedFile = undefined;
              }
              if (item.children) {
                deleteAttachedFilesRecursively(item.children);
              }
            }
          };
          deleteAttachedFilesRecursively(treeState.items);
          return treeState;
        };

        if (isValidTreeListItemIncludingItems(treeStateWithAttachedDFiles)) {
          // 複数のツリーが含まれる場合、TreesListItemIncludingItems[] を反復してツリーをDBに保存
          let temporaryTreesList = [...treesList];
          for (const tree of treeStateWithAttachedDFiles) {
            if (!isValidTreeState(tree) || !tree.name) {
              throw new Error('無効な複数ツリーファイル形式です。');
            }
            const treeState = deleteAttachedFilesState(tree);
            const newTreeRef: unknown = await saveNewTree(
              treeState.items,
              treeState.name ? treeState.name : '読み込まれたツリー',
              {
                [uid]: true,
              }
            );
            await updateTimeStamp(newTreeRef as UniqueIdentifier);
            setIsLoading(true)
            await copyTreeDataToIdbFromDb(newTreeRef as UniqueIdentifier);
            if (!newTreeRef) {
              throw new Error('ツリーのデータベースへの保存に失敗しました。');
            }
            const loadedTreeObject = {
              id: newTreeRef as UniqueIdentifier,
              name: treeState.name ? treeState.name : '読み込まれたツリー',
            };
            temporaryTreesList = [...temporaryTreesList, loadedTreeObject];
          }
          setTreesList(temporaryTreesList);
          await idbService.saveTreesListToIdb(temporaryTreesList);
          await dbService.saveTreesListDb(uid, temporaryTreesList);
          await loadAndSetTreesListFromIdb();
          setIsLoading(false);
          await showDialog('複数のツリーが正常に読み込まれました。', 'Information');
        } else {
          // 単体のツリーが含まれる場合、treeStateをDBに保存
          if (!isValidTreeState(treeStateWithAttachedDFiles)) {
            throw new Error('無効なファイル形式です。');
          } else {
            const treeState = deleteAttachedFilesState(treeStateWithAttachedDFiles);
            let treeName: string = '';
            if (!treeState.name && !treeState.currentTreeName) {
              treeName = '読み込まれたツリー';
            } else if (treeState.name) {
              treeName = treeState.name;
            } else if (treeState.currentTreeName) {
              treeName = treeState.currentTreeName;
            }
            const newTreeRef: unknown = await saveNewTree(treeState.items, treeName, {
              [uid]: true,
            });

            if (!newTreeRef) {
              throw new Error('ツリーのデータベースへの保存に失敗しました。');
            }

            setCurrentTree(newTreeRef as UniqueIdentifier);
            setCurrentTreeName(treeName);
            const loadedTreeObject = { id: newTreeRef as UniqueIdentifier, name: treeName };
            const updatedTreesListWithLoadedTree = treesList ? [...treesList, loadedTreeObject] : [loadedTreeObject];
            if (email) {
              setCurrentTreeMembers([{ uid: uid, email: email }]);
            } else {
              setCurrentTreeMembers([{ uid: uid, email: 'unknown' }]);
            }
            setTreesList(updatedTreesListWithLoadedTree);
            await idbService.saveTreesListToIdb(updatedTreesListWithLoadedTree);
            await dbService.saveTreesListDb(uid, updatedTreesListWithLoadedTree);
            await loadAndSetTreesListFromIdb();
            await copyTreeDataToIdbFromDb(newTreeRef as UniqueIdentifier);
            await loadAndSetCurrentTreeDataFromIdb(newTreeRef as UniqueIdentifier);
            await updateTimeStamp(newTreeRef as UniqueIdentifier);
            setIsLoading(false);
            const result = await showDialog('ファイルが正常に読み込まれました。', 'Information');
            if (result && treeName === '読み込まれたツリー') {
              setIsAccordionExpanded(true);
              // 0.7秒後にフォーカスをセット
              const timerTwo = setTimeout(() => {
                setIsFocusedTreeName(true);
              }, 700);
              return () => {
                clearTimeout(timerTwo);
                Promise.resolve();
              };
            }
            return Promise.resolve();
          }
        }
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
        await showDialog('ファイルの読み込みに失敗しました。\n\n' + error, 'Error');
        if (isLoading) setIsLoading(false);
        return Promise.reject();
      }
    } else {
      if (isLoading) setIsLoading(false);
      return Promise.reject();
    }
  }, [
    setIsLoading,
    showDialog,
    copyTreeDataToIdbFromDb,
    loadAndSetCurrentTreeDataFromIdb,
    loadAndSetTreesListFromIdb,
    saveNewTree,
    updateTimeStamp,
    setCurrentTree,
    setCurrentTreeMembers,
    setCurrentTreeName,
    setIsAccordionExpanded,
    setIsFocusedTreeName,
    setTreesList
  ]);

  // ファイルをアップロードするハンドラ
  const handleFileUpload = useCallback(async (file: File) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const isLoading = useAppStateStore.getState().isLoading;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!uid || (!isConnectedDb && !isOffline)) {
      return Promise.reject();
    }
    if (!file) {
      await showDialog('ファイルが選択されていません。', 'Information');
      return;
    }
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        await handleLoadedContent(text);
      } else {
        await showDialog('ファイルの読み込みに失敗しました。', 'Error');
      }
    };
    reader.readAsText(file);
    if (isLoading) setIsLoading(false);
  }, [
    handleLoadedContent,
    showDialog,
    setIsLoading,
  ]);

  // 現在のツリーをJSONファイルとしてダウンロードする ------------------------------------------------
  function getCurrentDateTime() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const handleDownloadTreeState = useCallback(async () => {
    const currentTreeName = useTreeStateStore.getState().currentTreeName;
    const items = useTreeStateStore.getState().items;
    if (!currentTreeName) return;
    const treeState: TreesListItemIncludingItems = { items: items, name: currentTreeName };
    const treeStateJSON = JSON.stringify(treeState, null, 2); // 読みやすい形式でJSONを整形
    const blob = new Blob([treeStateJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    if (!currentTreeName) {
      link.download = `TaskTree_Backup_${getCurrentDateTime()}.json`;
    } else {
      link.download = `TaskTree_${currentTreeName}_Backup_${getCurrentDateTime()}.json`;
    }
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: link.download,
          data: treeStateJSON,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'TaskTrees Backup title',
          text: 'TaskTrees Backup text',
          url: result.uri,
          dialogTitle: 'TaskTrees Backup dialog title',
        });
        return result.uri;
      } catch (error) {
        if (error instanceof Error && error.message.includes('cancel')) {
          return '';
        }
        await showDialog('ファイルの保存に失敗しました。\n\n' + error, 'Error');
        return '';
      }
    } else {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return '';
    }
  }, [showDialog]);

  // すべてのツリーをJSONファイルとしてダウンロードする --------------------------------------------------------------------------
  const handleDownloadAllTrees = useCallback(async (isSilent: boolean = false) => {
    try {
      const uid = useAppStateStore.getState().uid;
      const isOffline = useAppStateStore.getState().isOffline;
      const treesList = useTreeStateStore.getState().treesList;
      const isConnectedDb = useAppStateStore.getState().isConnectedDb;
      if (!uid || !isConnectedDb || isOffline || !treesList) {
        throw new Error('データベースとの接続が確立されていません');
      }
      const treesListItemIncludingItems: TreesListItemIncludingItems[] | null | undefined =
        await dbService.loadAllTreesDataFromDb(treesList);
      if (!treesListItemIncludingItems) {
        throw new Error('データベースからツリーのデータを読み込めませんでした');
      }
      if (isSilent) {
        // バックエンドにデータを送信するだけの場合
        // 人間に読みやすい形に変換
        const data = JSON.stringify(treesListItemIncludingItems, null, 2);
        return Promise.resolve(data);
      }

      // JSON形式でダウンロードする
      const link = document.createElement('a');
      const treeStateJSON = JSON.stringify(treesListItemIncludingItems, null, 2); // 人間に読みやすい形に変換
      const file = new Blob([treeStateJSON], { type: 'application/json' });
      link.href = URL.createObjectURL(file);
      link.download = `TaskTrees_AllBackup_${getCurrentDateTime()}.json`;

      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({
          path: link.download,
          data: treeStateJSON,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'TaskTrees Backup title',
          text: 'TaskTrees Backup text',
          url: result.uri,
          dialogTitle: 'TaskTrees Backup dialog title',
        });
        return Promise.resolve(result.uri);
      } else {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return Promise.resolve('');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancel')) {
        return Promise.resolve('');
      }
      await showDialog('ツリーのバックアップに失敗しました。\n\n' + error, 'Error');
      return Promise.reject('');
    }
  }, [showDialog]);

  // ツリー名の変更 ---------------------------------------------------------------------------
  const handleTreeNameSubmit = useCallback(async (editedTreeName: string) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const currentTreeName = useTreeStateStore.getState().currentTreeName;
    const currentTree = useTreeStateStore.getState().currentTree;
    const treesList = useTreeStateStore.getState().treesList;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if ((!uid && !isOffline) || !currentTree || (!isConnectedDb && !isOffline)) {
      return;
    }
    if (editedTreeName !== null && editedTreeName !== '' && editedTreeName !== currentTreeName) {
      setCurrentTreeName(editedTreeName);
      if (isOffline) {
        Preferences.set({ key: `treeName_offline`, value: editedTreeName });
      } else {
        await idbService.saveCurrentTreeNameToIdb(currentTree, editedTreeName);
        await dbService.saveCurrentTreeNameDb(currentTree, editedTreeName);
      }
      if (treesList) {
        const newList = treesList.map((tree) => {
          if (tree.id === currentTree) {
            return { ...tree, name: editedTreeName };
          }
          return tree;
        });
        setTreesList(newList);
        if (uid && !isOffline) {
          await idbService.saveTreesListToIdb(newList);
          await dbService.saveTreesListDb(uid, newList);
          await updateTimeStamp(currentTree);
        }
      }
    }
  }, [setCurrentTreeName, setTreesList, updateTimeStamp]);

  // メンバーの追加 ---------------------------------------------------------------------------
  const handleAddUserToTree = useCallback(async () => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const currentTree = useTreeStateStore.getState().currentTree;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!currentTree || !uid || (!isConnectedDb && !isOffline)) return Promise.resolve();
    const email = await showInputDialog(
      '追加する編集メンバーのメールアドレスを入力してください。共有メンバーはこのアプリにユーザー登録されている必要があります。',
      'Add Member',
      'Email',
      null,
      false
    );
    if (!email) return Promise.resolve();
    setIsLoading(true);
    const functions = getFunctions();
    const addUserToTreeCallable = httpsCallable(functions, 'addUserToTree');
    try {
      const result = await addUserToTreeCallable({
        email,
        treeId: currentTree,
      });
      await copyTreeDataToIdbFromDb(currentTree);
      await loadAndSetCurrentTreeDataFromIdb(currentTree);
      setIsLoading(false);
      await updateTimeStamp(currentTree);
      return Promise.resolve(result.data);
    } catch (error) {
      setIsLoading(false);
      await showDialog(
        'メンバーの追加に失敗しました。メールアドレスを確認して再度実行してください。\n\n' + error,
        'Information'
      );
      return Promise.reject(error);
    }
  }, [
    showDialog,
    showInputDialog,
    setIsLoading,
    copyTreeDataToIdbFromDb,
    loadAndSetCurrentTreeDataFromIdb,
    updateTimeStamp,
  ]);

  // メンバーの削除 ---------------------------------------------------------------------------
  const handleDeleteUserFromTree = useCallback(async (rescievedUid: string, rescievedEmail: string) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const currentTree = useTreeStateStore.getState().currentTree;
    const currentTreeMembers = useTreeStateStore.getState().currentTreeMembers;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!currentTree || !uid || (!isConnectedDb && !isOffline)) return Promise.resolve();
    let result;
    if (currentTreeMembers && currentTreeMembers.length === 1) {
      await showDialog('最後のメンバーを削除することはできません。', 'Information');
      return Promise.resolve();
    }
    if (uid && uid === rescievedUid) {
      result = await showDialog(
        '自分自身を削除すると、このツリーにアクセスできなくなります。実行しますか？',
        'Confirmation Required',
        true
      );
    } else {
      result = await showDialog(
        `メンバー' ${rescievedEmail} 'をこのツリーの編集メンバーから削除します。実行しますか？`,
        'Confirmation Required',
        true
      );
    }
    if (result) {
      setIsLoading(true);
      const functions = getFunctions();
      const removeUserFromTreeCallable = httpsCallable(functions, 'removeUserFromTree');
      try {
        const result = await removeUserFromTreeCallable({
          treeId: currentTree,
          userId: rescievedUid,
        });
        await updateTimeStamp(currentTree);
        if (uid && uid === rescievedUid) {
          setCurrentTree(null);
          setCurrentTreeName(null);
          setCurrentTreeMembers(null);
          setItems([]);
          setIsAccordionExpanded(false);
          await idbService.deleteTreeFromIdb(currentTree);
          const { orderedTreesList } = await dbService.loadTreesListFromDb(uid);
          await idbService.saveTreesListToIdb(orderedTreesList);
          setTreesList(orderedTreesList);
        } else {
          await copyTreeDataToIdbFromDb(currentTree);
          await loadAndSetCurrentTreeDataFromIdb(currentTree);
        }
        setIsLoading(false);
        return Promise.resolve(result.data);
      } catch (error) {
        setIsLoading(false);
        await showDialog('メンバーの削除に失敗しました。\n\n' + error, 'Error');
        return Promise.reject(error);
      }
    }
    return Promise.resolve();
  }, [
    copyTreeDataToIdbFromDb,
    loadAndSetCurrentTreeDataFromIdb,
    updateTimeStamp,
    setCurrentTree,
    setCurrentTreeMembers,
    setCurrentTreeName,
    setIsAccordionExpanded,
    setItems,
    setTreesList,
    setIsLoading,
    showDialog,
  ]);

  // ツリーのアーカイブ属性を変更 ---------------------------------------------------------------------------
  const handleChangeIsArchived = useCallback(async (targetTree: UniqueIdentifier | null, isArchived: boolean | null) => {
    const uid = useAppStateStore.getState().uid;
    const isOffline = useAppStateStore.getState().isOffline;
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if (!targetTree || !uid || (!isConnectedDb && !isOffline)) return Promise.resolve();
    await idbService.saveIsArchivedToIdb(targetTree, isArchived);
    await dbService.saveIsArchivedDb(targetTree, isArchived);
    setCurrentTreeIsArchived(isArchived);
    const newList = useTreeStateStore.getState().treesList.map((tree) => {
      if (tree.id === targetTree) {
        return { ...tree, isArchived: isArchived ?? undefined };
      }
      return tree;
    });
    setTreesList(newList);
    await updateTimeStamp(targetTree);
  }, [updateTimeStamp, setCurrentTreeIsArchived, setTreesList]);

  return {
    deleteTree,
    saveItems,
    handleSaveTreesList,
    handleCreateNewTree,
    handleCreateOfflineTree,
    handleFileUpload,
    handleLoadedContent,
    handleDownloadTreeState,
    handleDownloadAllTrees,
    handleTreeNameSubmit,
    handleAddUserToTree,
    handleDeleteUserFromTree,
    handleDeleteTree,
    handleChangeIsArchived,
    loadAndSetTreesListFromDb,
    loadAndSetTreesListFromIdb,
    loadAndSetCurrentTreeDataFromIdb,
  };
};
