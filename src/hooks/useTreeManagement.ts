import { useCallback } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList, TreesListItem, TreesListItemIncludingItems } from '../types/types';
import { isTreeItemArray } from '../components/SortableTree/utilities';
import { initialItems, initialOfflineItems } from '../components/SortableTree/mock';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useAttachedFile } from './useAttachedFile';
import { useError } from './useError';
import { useDatabase } from './useDatabase';
import { useIndexedDb } from './useIndexedDb';
import { useDialogStore, useInputDialogStore } from '../store/dialogStore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';

// ツリーの管理に関するカスタムフック
// データベースに関連する処理はuseDatabaseフックを使用

export const useTreeManagement = () => {
  const isOffline = useAppStateStore((state) => state.isOffline);
  const uid = useAppStateStore((state) => state.uid);
  const email = useAppStateStore((state) => state.email);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const setIsAccordionExpanded = useAppStateStore((state) => state.setIsAccordionExpanded);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);

  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const currentTreeMembers = useTreeStateStore((state) => state.currentTreeMembers);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);
  const prevCurrentTree = useTreeStateStore((state) => state.prevCurrentTree);
  const setPrevCurrentTree = useTreeStateStore((state) => state.setPrevCurrentTree);
  const prevItems = useTreeStateStore((state) => state.prevItems);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);

  const showDialog = useDialogStore((state) => state.showDialog);
  const showInputDialog = useInputDialogStore((state) => state.showDialog);

  const { handleError } = useError();
  const {
    saveItemsDb,
    saveTreesListDb,
    saveCurrentTreeNameDb,
    loadTreesListFromDb,
    loadTreeNameFromDb,
    loadAllTreesDataFromDb,
    deleteTreeFromDb,
  } = useDatabase();
  const { copyTreeDataToIdbFromDb,
    loadCurrentTreeDataFromIdb,
    loadTreesListFromIdb,
    saveItemsIdb,
    saveTreesListIdb,
    saveCurrentTreeNameIdb,
    deleteTreeIdb
  } = useIndexedDb();
  const { deleteFile } = useAttachedFile();

  // ツリーリストをDBから取得する ---------------------------------------------------------------------------
  const loadTreesList = async () => {
    try {
      if (!uid) {
        return;
      }
      if (!isLoading) setIsLoading(true);
      const treesListFromDb = await loadTreesListFromDb(uid);
      let missingTrees: string[] = [];
      if (treesListFromDb) {
        const data: string[] = treesListFromDb;
        let treesListAccumulator: TreesList = [];
        // 反復してツリー名をDBから取得
        const promises = data.map(async (treeId) => {
          const treeTitle = await loadTreeNameFromDb(treeId);
          if (treeTitle) {
            treesListAccumulator = [...treesListAccumulator, { id: treeId, name: treeTitle }];
          } else {
            console.log('ツリー名が取得できませんでした。' + treeId + 'のツリーは削除されている可能性があります。');
            missingTrees = missingTrees ? [...missingTrees, treeId] : [treeId];
          }
        });
        await Promise.all(promises);
        // DBの順序に基づいてtreesListAccumulatorを並び替え
        const orderedTreesList = data
          .map((treeId) => treesListAccumulator.find((t) => t.id === treeId))
          .filter((t): t is TreesListItem => t !== undefined);
        setTreesList(orderedTreesList);
        setIsLoading(false);
      } else {
        setTreesList([]);
        console.log('ツリーリストが見つかりませんでした。');
        setIsLoading(false);
      }

      // 削除されたツリーを通知
      if (missingTrees && missingTrees.length > 0) {
        await showDialog('1つ以上のツリーが他のユーザーまたはシステムによって削除されました。\n\n' + missingTrees, 'Information');
      }
    } catch (error) {
      handleError('ツリーリストの取得に失敗しました。\n\n' + error);
    }
  };

  // ターゲットIDのitems、name、membersをDBからロードする ---------------------------------------------------------------------------
  const loadCurrentTreeData = async (targetTree: UniqueIdentifier) => {
    if (!isLoading) setIsLoading(true);
    // デバウンスで前のツリーの状態変更が残っていたら保存
    if (prevCurrentTree && prevCurrentTree !== targetTree && prevItems.length !== 0 && prevItems !== items) {
      await saveItemsIdb(prevItems, prevCurrentTree);
      await saveItemsDb(prevItems, prevCurrentTree);
      setPrevItems(items);
    }

    try {
      if (!uid) {
        throw new Error('ユーザーがログインしていません。');
      }
      const treeData = await loadCurrentTreeDataFromIdb(targetTree);
      if (treeData && treeData.name && treeData.membersV2 && treeData.items) {
        setCurrentTreeName(treeData.name);
        const members: { uid: string; email: string }[] = [];
        for (const member in treeData.membersV2) {
          members.push({ uid: member, email: treeData.membersV2[member] });
        }
        setCurrentTreeMembers(members);
        setPrevItems([]);
        setPrevCurrentTree(targetTree);
        setItems(treeData.items);
      }

      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      handleError('ツリーのデータの取得に失敗しました。\n\n' + error);
    }
  };

  //ツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTree = async (targetTree: UniqueIdentifier) => {
    if (!uid) {
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

    setCurrentTree(null);
    setCurrentTreeName(null);
    setCurrentTreeMembers(null);
    setPrevCurrentTree(null);
    setPrevItems([]);
    setItems([]);
    setIsAccordionExpanded(false);

    try {
      await deleteTreeIdb(targetTree);
      await deleteTreeFromDb(targetTree);
      const updatedTreesList = treesList ? treesList.filter((tree) => tree.id !== targetTree) : [];
      setTreesList(updatedTreesList);
      await saveTreesListIdb(updatedTreesList);
      await saveTreesListDb(updatedTreesList);
    } catch (error) {
      await showDialog('ツリーの削除に失敗しました。\n\n' + error, 'Error');
    }
  };

  const handleDeleteTree = async () => {
    const result = await showDialog(
      'すべての編集メンバーからツリーが削除されます。この操作は元に戻せません。実行しますか？',
      'Confirmation Required',
      true
    );
    if (result) {
      await deleteTree(currentTree as UniqueIdentifier);
    }
  };

  // サーバに新しいツリーを保存するFirebase関数 ---------------------------------------------------------------------------
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
        showDialog('メンバーのメールアドレスの取得に失敗しました。\n\n' + error, 'Error');
        return []; // エラーが発生した場合は空の配列を返す
      }
    },
    [showDialog]
  );

  // 新しいツリーを作成する ---------------------------------------------------------------------------
  const handleCreateNewTree = async () => {
    if (isOffline) {
      await showDialog('オフラインモードでは新しいツリーを作成できません。', 'Information');
    }
    if (!uid) {
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

      setIsAccordionExpanded(true);
      // 0.5秒後にフォーカスをセット
      const timerOne = setTimeout(() => {
        setIsFocusedTreeName(true);
      }, 500);
      setIsLoading(false);
      setCurrentTree(newTreeRef as UniqueIdentifier);
      setCurrentTreeName('新しいツリー');
      if (email) {
        setCurrentTreeMembers([{ uid: uid, email: email }]);
      } else {
        setCurrentTreeMembers([{ uid: uid, email: 'unknown' }]);
      }
      if (newTreeRef !== null) {
        const newTree = { id: newTreeRef as UniqueIdentifier, name: '新しいツリー' };
        const updatedTreesListWithNewTree = treesList ? [...treesList, newTree] : [newTree];
        setTreesList(updatedTreesListWithNewTree);
        await saveTreesListIdb(updatedTreesListWithNewTree);
        await saveTreesListDb(updatedTreesListWithNewTree);
        await copyTreeDataToIdbFromDb(newTreeRef as UniqueIdentifier);
        await loadCurrentTreeData(newTreeRef as UniqueIdentifier);
        await loadTreesListFromIdb();
      }

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
  };

  //オフラインツリーを作成する ---------------------------------------------------------------------------
  const handleCreateOfflineTree = async () => {
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
  };

  // ファイルを読み込んでツリーの状態を復元する ---------------------------------------------------------------------------
  const handleFileUpload = async (file: File) => {
    if (!uid) {
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
  };

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
  const handleLoadedContent = async (data: string | null) => {
    if (!uid) {
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
          await saveTreesListIdb(temporaryTreesList);
          await saveTreesListDb(temporaryTreesList);
          await loadTreesListFromIdb();
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
            if (isLoading) setIsLoading(false);
            setTreesList(updatedTreesListWithLoadedTree);
            await saveTreesListIdb(updatedTreesListWithLoadedTree);
            await saveTreesListDb(updatedTreesListWithLoadedTree);
            await loadTreesListFromIdb();
            await copyTreeDataToIdbFromDb(newTreeRef as UniqueIdentifier);
            await loadCurrentTreeData(newTreeRef as UniqueIdentifier);
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
  };

  // 現在のツリーをJSONファイルとしてダウンロードする ------------------------------------------------
  function getCurrentDateTime() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const handleDownloadTreeState = async () => {
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
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'TaskTrees Backup title',
          text: 'TaskTrees Backup text',
          url: result.uri,
          dialogTitle: 'TaskTrees Backup dialog title',
        });
        await Filesystem.deleteFile({
          path: result.uri,
          directory: Directory.Documents,
        });
        return result.uri;
      } catch (e) {
        console.error('Error saving file:', e);
        return '';
      }
    } else {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return '';
    }
  };

  // すべてのツリーをJSONファイルとしてダウンロードする --------------------------------------------------------------------------
  const handleDownloadAllTrees = async (isSilent: boolean = false) => {
    if (!uid && !treesList) {
      return Promise.reject('');
    }
    try {
      const treesListItemIncludingItems: TreesListItemIncludingItems[] | null | undefined =
        await loadAllTreesDataFromDb(treesList);
      if (!treesListItemIncludingItems) {
        return Promise.reject('');
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
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'TaskTrees Backup title',
          text: 'TaskTrees Backup text',
          url: result.uri,
          dialogTitle: 'TaskTrees Backup dialog title',
        });
        await Filesystem.deleteFile({
          path: result.uri,
          directory: Directory.Documents,
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
      await showDialog('ツリーのバックアップに失敗しました。\n\n' + error, 'Error');
      return Promise.reject('');
    }
  };

  // ツリー名の変更 ---------------------------------------------------------------------------
  const handleTreeNameSubmit = async (editedTreeName: string) => {
    if (editedTreeName !== null && editedTreeName !== '' && editedTreeName !== currentTreeName) {
      setCurrentTreeName(editedTreeName);
      if (isOffline) {
        Preferences.set({ key: `treeName_offline`, value: editedTreeName });
      } else {
        await saveCurrentTreeNameIdb(editedTreeName, currentTree);
        await saveCurrentTreeNameDb(editedTreeName, currentTree);
      }
      if (treesList) {
        const newList = treesList.map((tree) => {
          if (tree.id === currentTree) {
            return { ...tree, name: editedTreeName };
          }
          return tree;
        });
        setTreesList(newList);
        await saveTreesListIdb(newList);
        await saveTreesListDb(newList);
      }
    }
  };

  // メンバーの追加 ---------------------------------------------------------------------------
  const handleAddUserToTree = async () => {
    if (!currentTree) return Promise.resolve();
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
      await loadCurrentTreeData(currentTree);
      setIsLoading(false);
      return Promise.resolve(result.data);
    } catch (error) {
      setIsLoading(false);
      await showDialog(
        'メンバーの追加に失敗しました。メールアドレスを確認して再度実行してください。\n\n' + error,
        'Information'
      );
      return Promise.reject(error);
    }
  };

  // メンバーの削除 ---------------------------------------------------------------------------
  const handleDeleteUserFromTree = async (rescievedUid: string, rescievedEmail: string) => {
    if (!currentTree) return Promise.resolve();
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
        if (uid && uid === rescievedUid) {
          setCurrentTree(null);
          setCurrentTreeName(null);
          setCurrentTreeMembers(null);
          setPrevCurrentTree(null);
          setPrevItems([]);
          setItems([]);
          setIsAccordionExpanded(false);
          await deleteTreeIdb(currentTree);
        } else {
          await copyTreeDataToIdbFromDb(currentTree);
          await loadCurrentTreeData(currentTree);
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
  };

  return {
    deleteTree,
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
    loadTreesList,
    loadCurrentTreeData,
  };
};
