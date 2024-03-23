import { useCallback } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList, TreesListItem, TreesListItemIncludingItems } from '../types/types';
import { isTreeItemArray, ensureChildrenProperty } from '../components/SortableTree/utilities';
import { initialItems } from '../components/SortableTree/mock';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useAttachedFile } from './useAttachedFile';
import { useError } from './useError';
import { useDatabase } from './useDatabase';
import { useDialogStore, useInputDialogStore } from '../store/dialogStore';

export const useTreeManagement = () => {
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

  // エラーハンドリング
  const { handleError } = useError();

  // データベース関連の関数
  const { saveItemsDb, saveTreesListDb, saveCurrentTreeNameDb, loadAllTreesDataFromDb, deleteTreeFromDb } = useDatabase();

  // ファイルのアップロードとダウンロード
  const { deleteFile } = useAttachedFile();

  // ツリーリストをDBから取得する ---------------------------------------------------------------------------
  const loadTreesListFromDb = useCallback(async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) {
        return;
      }
      setIsLoading(true);
      const db = getDatabase();
      const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
      const snapshot = await get(userTreeListRef);
      let missingTrees: string[] = [];
      if (snapshot.exists()) {
        const data: string[] = snapshot.val();
        let treesListAccumulator: TreesList = [];
        // 反復してツリー名をDBから取得
        const promises = data.map((treeId) =>
          new Promise<void>((resolve) => {
            const treeTitleRef = ref(db, `trees/${treeId}/name`);
            get(treeTitleRef)
              .then((snapshot) => {
                if (snapshot.exists()) {
                  treesListAccumulator = [...treesListAccumulator, { id: treeId, name: snapshot.val() }];
                }
                resolve();
              })
              .catch(() => {
                console.log('ツリーが見つかりませんでした。');
                missingTrees = missingTrees ? [...missingTrees, treeId] : [treeId];
                resolve();
              });
          })
        );
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
  }, [handleError, setIsLoading, setTreesList, showDialog]);

  // ターゲットIDのitems、name、membersをDBからロードする ---------------------------------------------------------------------------

  // メンバーリストからメールアドレスリストを取得する
  const getMemberEmails = useCallback(
    async (memberList: string[]) => {
      const functions = getFunctions();
      const getUserEmails = httpsCallable(functions, 'getUserEmails');

      try {
        const result = await getUserEmails({ userIds: memberList });
        // レスポンスの処理
        const emails = (result.data as { emails: string[] }).emails;
        return emails; // ここでemailsを返す
      } catch (error) {
        showDialog('メンバーのメールアドレスの取得に失敗しました。\n\n' + error, 'Error');
        return []; // エラーが発生した場合は空の配列を返す
      }
    },
    [showDialog]
  );

  // 本編
  const loadCurrentTreeDataFromDb = useCallback(async (targetTree: UniqueIdentifier) => {
    setIsLoading(true);
    // デバウンスで前のツリーの状態変更が残っていたら保存
    if (
      prevCurrentTree &&
      prevCurrentTree !== targetTree &&
      prevItems.length !== 0 &&
      prevItems !== items
    ) {
      saveItemsDb(items, prevCurrentTree);
      setPrevItems(items);
    }

    try {
      const db = getDatabase();
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error('ユーザーがログインしていません。');
      }

      // ツリーアイテムを取得
      const treeItemsRef = ref(db, `trees/${targetTree}/items`);
      const snapshotItems = await get(treeItemsRef);
      if (snapshotItems.exists()) {
        const data: TreeItem[] = snapshotItems.val();
        const itemsWithChildren = ensureChildrenProperty(data);
        if (isTreeItemArray(itemsWithChildren)) {
          setPrevItems([]);
          setPrevCurrentTree(targetTree);
          setItems(itemsWithChildren);
        } else {
          throw new Error('取得したデータがTreeItem[]型ではありません。');
        }
      } else {
        setItems([]);
      }

      // ツリー名を取得
      const treeNameRef = ref(db, `trees/${targetTree}/name`);
      const snapshotName = await get(treeNameRef);
      if (snapshotName.exists()) {
        setCurrentTreeName(snapshotName.val());
      } else {
        setCurrentTreeName(null);
      }

      // ツリーメンバーを取得
      const treeMembersRef = ref(db, `trees/${targetTree}/members`);
      const snapshotMembers = await get(treeMembersRef);
      if (snapshotMembers.exists()) {
        const membersObject = snapshotMembers.val();
        const uids = Object.keys(membersObject); // UIDのリストを取得

        // UIDリストを使用して、メールアドレスを取得
        const emails = await getMemberEmails(uids);
        // メンバーリストとメールアドレスを組み合わせてオブジェクトの配列を作成
        const membersWithEmails = uids.map((uid, index) => ({
          uid,
          email: emails[index], // 対応するメールアドレス
        }));
        setCurrentTreeMembers(membersWithEmails);
      } else {
        setCurrentTreeMembers(null);
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      handleError('ツリーのデータの取得に失敗しました。\n\n' + error);
    }
  }, [items, prevItems, prevCurrentTree, getMemberEmails, handleError, setCurrentTreeMembers, setCurrentTreeName, setIsLoading, setItems, saveItemsDb, setPrevItems, setPrevCurrentTree]);

  //ツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTree = async (targetTree: UniqueIdentifier) => {
    const user = getAuth().currentUser;
    const db = getDatabase();
    if (!user || !db) {
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
    setItems([]);
    setIsAccordionExpanded(false);

    try {
      deleteTreeFromDb(targetTree);
      const updatedTreesList = treesList ? treesList.filter((tree) => tree.id !== targetTree) : [];
      setTreesList(updatedTreesList);
      saveTreesListDb(updatedTreesList);
    } catch (error) {
      await showDialog('ツリーの削除に失敗しました。\n\n' + error, 'Error');
    }
  };

  // サーバに新しいツリーを保存する関数 ---------------------------------------------------------------------------
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
    const user = getAuth().currentUser;
    if (!user) {
      return Promise.reject();
    }

    setCurrentTree(null);
    setIsLoading(true);

    try {
      const newTreeRef: unknown = await saveNewTree(initialItems, '新しいツリー', {
        [user?.uid]: true,
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
      if (user.email) {
        setCurrentTreeMembers([{ uid: user.uid, email: user.email }]);
      } else {
        setCurrentTreeMembers([{ uid: user.uid, email: 'unknown' }]);
      }
      if (newTreeRef !== null) {
        const newTree = { id: newTreeRef as UniqueIdentifier, name: '新しいツリー' };
        const updatedTreesListWithNewTree = treesList ? [...treesList, newTree] : [newTree];
        setTreesList(updatedTreesListWithNewTree);
        saveTreesListDb(updatedTreesListWithNewTree);
        await loadCurrentTreeDataFromDb(newTreeRef as UniqueIdentifier);
        await loadTreesListFromDb();
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

  // ファイルを読み込んでツリーの状態を復元する ---------------------------------------------------------------------------
  const handleFileUpload = async (file: File) => {
    const user = getAuth().currentUser;
    if (!user) {
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
    const user = getAuth().currentUser;
    if (!user) {
      return Promise.reject();
    }
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
                [user.uid]: true,
              }
            );
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
          saveTreesListDb(temporaryTreesList);
          await loadTreesListFromDb();
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
              [user.uid]: true,
            });

            if (!newTreeRef) {
              throw new Error('ツリーのデータベースへの保存に失敗しました。');
            }

            setCurrentTree(newTreeRef as UniqueIdentifier);
            setCurrentTreeName(treeName);
            const loadedTreeObject = { id: newTreeRef as UniqueIdentifier, name: treeName };
            const updatedTreesListWithLoadedTree = treesList ? [...treesList, loadedTreeObject] : [loadedTreeObject];
            if (user.email) {
              setCurrentTreeMembers([{ uid: user.uid, email: user.email }]);
            } else {
              setCurrentTreeMembers([{ uid: user.uid, email: 'unknown' }]);
            }
            if (isLoading) setIsLoading(false);
            setTreesList(updatedTreesListWithLoadedTree);
            saveTreesListDb(updatedTreesListWithLoadedTree);
            await loadTreesListFromDb();
            await loadCurrentTreeDataFromDb(newTreeRef as UniqueIdentifier);
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
  // 現在の日時を取得する
  function getCurrentDateTime() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const handleDownloadTreeState = () => {
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // すべてのツリーをJSONファイルとしてダウンロードする --------------------------------------------------------------------------
  const handleDownloadAllTrees = async (isSilent: boolean = false) => {
    const user = getAuth().currentUser;
    if (!user && !treesList) {
      return Promise.reject('');
    }
    try {
      const treesListItemIncludingItems: TreesListItemIncludingItems[] | null | undefined =
        await loadAllTreesDataFromDb(treesList);
      if (!treesListItemIncludingItems) {
        return Promise.reject('');
      }
      if (isSilent) {
        // JSON形式でダウンロードする
        // 人間に読みやすい形に変換
        const data = JSON.stringify(treesListItemIncludingItems, null, 2);
        return Promise.resolve(data);
      }
      // JSON形式でダウンロードする
      const a = document.createElement('a');
      // 人間に読みやすい形に変換
      const file = new Blob([JSON.stringify(treesListItemIncludingItems, null, 2)], {
        type: 'application/json',
      });
      a.href = URL.createObjectURL(file);
      a.download = `TaskTrees_AllBackup_${getCurrentDateTime()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return Promise.resolve('');
    } catch (error) {
      await showDialog('ツリーのバックアップに失敗しました。\n\n' + error, 'Error');
      return Promise.reject('');
    }
  };

  // ツリー名の変更 ---------------------------------------------------------------------------
  const handleTreeNameSubmit = (editedTreeName: string) => {
    if (editedTreeName !== null && editedTreeName !== '' && editedTreeName !== currentTreeName) {
      setCurrentTreeName(editedTreeName);
      saveCurrentTreeNameDb(editedTreeName, currentTree);
      if (treesList) {
        const newList = treesList.map((tree) => {
          if (tree.id === currentTree) {
            return { ...tree, name: editedTreeName };
          }
          return tree;
        });
        setTreesList(newList);
        saveTreesListDb(newList);
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
    const functions = getFunctions();
    const addUserToTreeCallable = httpsCallable(functions, 'addUserToTree');
    try {
      const result = await addUserToTreeCallable({
        email,
        treeId: currentTree,
      });

      setIsLoading(false);
      return Promise.resolve(result.data);
    } catch (error) {
      await showDialog(
        'メンバーの追加に失敗しました。メールアドレスを確認して再度実行してください。\n\n' + error,
        'IInformation'
      );
      setIsLoading(false);
      return Promise.reject(error);
    }
  };

  // メンバーの削除 ---------------------------------------------------------------------------
  const handleDeleteUserFromTree = async (uid: string, email: string) => {
    if (!currentTree) return Promise.resolve();
    const user = getAuth().currentUser;
    let result;
    if (currentTreeMembers && currentTreeMembers.length === 1) {
      await showDialog('最後のメンバーを削除することはできません。', 'Information');
      return Promise.resolve();
    }
    if (user && user.uid === uid) {
      result = await showDialog(
        '自分自身を削除すると、このツリーにアクセスできなくなります。実行しますか？',
        'Confirmation Required',
        true
      );
    } else {
      result = await showDialog(
        `メンバー' ${email} 'をこのツリーの編集メンバーから削除します。実行しますか？`,
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
          userId: uid,
        });
        setIsLoading(false);
        return Promise.resolve(result.data);
      } catch (error) {
        await showDialog('メンバーの削除に失敗しました。\n\n' + error, 'Error');
        setIsLoading(false);
        return Promise.reject(error);
      }
    }
    return Promise.resolve();
  };

  // ツリーの削除 ---------------------------------------------------------------------------
  const handleDeleteTree = async () => {
    const result = await showDialog(
      'すべての編集メンバーからツリーが削除されます。この操作は元に戻せません。実行しますか？',
      'Confirmation Required',
      true
    );
    if (result) {
      await deleteTree(currentTree as string);
    }
  };


  return {
    deleteTree,
    handleCreateNewTree,
    handleFileUpload,
    handleLoadedContent,
    handleDownloadTreeState,
    handleDownloadAllTrees,
    handleTreeNameSubmit,
    handleAddUserToTree,
    handleDeleteUserFromTree,
    handleDeleteTree,
    loadTreesListFromDb,
    loadCurrentTreeDataFromDb,

  };
};
