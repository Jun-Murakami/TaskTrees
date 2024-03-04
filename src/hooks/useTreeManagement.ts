import { useEffect, useCallback, useState, useRef } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList, TreesListItem } from '../types/types';
import { isTreeItemArray, isValidAppState, ensureChildrenProperty } from '../components/SortableTree/utilities';
import { initialItems } from '../components/SortableTree/mock';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue, set, get } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useTaskStateStore } from '../store/taskStateStore';
import { useError } from './useError';
import { useDatabase } from './useDatabase';
import { useDialogStore } from '../store/dialogStore';

export const useTreeManagement = () => {
  const [missingTrees, setMissingTrees] = useState<string[] | null>(null);

  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const setIsAccordionExpanded = useAppStateStore((state) => state.setIsAccordionExpanded);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);

  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);

  const setLastSelectedItemId = useTaskStateStore((state) => state.setLastSelectedItemId);

  const showDialog = useDialogStore((state) => state.showDialog);

  // エラーハンドリング
  const { handleError } = useError();

  // データベース関連の関数
  const { saveItemsDb, saveTreesListDb } = useDatabase();

  // ツリーリストのDB側の監視→変更されたらツリーリストを更新 ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const user = getAuth().currentUser;
      const db = getDatabase();
      if (!user || !isLoggedIn || !db) {
        return;
      }
      setIsLoading(true);
      const treeListRef = ref(db, `users/${user.uid}/treeList`);
      const unsubscribe = onValue(treeListRef, (snapshot) => {
        if (snapshot.exists()) {
          const data: string[] = snapshot.val();
          let treesListAccumulator: TreesList = [];
          const promises = data.map((treeId) =>
            new Promise<void>((resolve) => {
              const treeTitleRef = ref(db, `trees/${treeId}/name`);
              // まずget関数を使用してデータの存在を確認
              get(treeTitleRef).then((snapshot) => {
                if (snapshot.exists()) {
                  treesListAccumulator = [...treesListAccumulator, { id: treeId, name: snapshot.val() }];
                  // データが存在する場合のみonValueで監視を開始
                  onValue(treeTitleRef, (snapshot) => {
                    if (snapshot.exists()) {
                      treesListAccumulator = treesListAccumulator.map(t => t.id === treeId ? { ...t, name: snapshot.val() } : t);
                    }
                    // onValue内ではresolveを呼び出さない
                  });
                } else {
                  console.log('ツリーが見つかりませんでした。');
                  setMissingTrees((prev) => prev ? [...prev, treeId] : [treeId]);
                }
                // getの結果に関わらず、Promiseを解決
                resolve();
              }).catch(() => {
                console.log('ツリーが見つかりませんでした。');
                setMissingTrees((prev) => prev ? [...prev, treeId] : [treeId]);
                resolve(); // エラーが発生してもPromiseを解決
              });
            }).catch((error) => {
              console.log('trees/${treeId}/nameの監視中にエラーが発生しました' + error);
              setMissingTrees((prev) => prev ? [...prev, treeId] : [treeId]);
            })
          );

          Promise.all(promises).then(() => {
            setIsLoading(false);
            // DBの順序に基づいてtreesListAccumulatorを並び替え
            const orderedTreesList = data.map(treeId => treesListAccumulator.find(t => t.id === treeId)).filter((t): t is TreesListItem => t !== undefined);
            setTreesList(orderedTreesList);
          });
        } else {
          setIsLoading(false);
          setTreesList([]);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      setIsLoading(false);
      handleError('ツリーリストの監視中にエラーが発生しました' + error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);


  // 現在のツリーIDのDB側の監視→変更されたらitemsをデータベースから取得 ---------------------------------------------------------------------------
  const prevCurrentTreeRef = useRef<UniqueIdentifier | null>(null);
  const prevItemsRef = useRef<TreeItem[]>([]);

  useEffect(() => {
    if (currentTree) {
      setIsLoading(true);
      setLastSelectedItemId(null);
      // デバウンスで前のツリーの状態変更が残っていたら保存
      if (prevCurrentTreeRef.current && prevCurrentTreeRef.current !== currentTree && prevItemsRef.current.length !== 0 && prevItemsRef.current !== items) {
        saveItemsDb(items, prevCurrentTreeRef.current);
      }

      try {
        const db = getDatabase();
        if (!getAuth().currentUser) {
          throw new Error('ユーザーがログインしていません。');
        }

        // ツリーアイテムのデータベースの変更をリアルタイムで監視
        const treeItemsRef = ref(db, `trees/${currentTree}/items`);
        const unsubscribeItems = onValue(treeItemsRef, (snapshot) => {
          // データが存在する場合は取得し、itemsにセット
          if (snapshot.exists()) {
            const data: TreeItem[] = snapshot.val();
            const itemsWithChildren = ensureChildrenProperty(data);
            // 取得したデータがTreeItem[]型であることを確認
            if (isTreeItemArray(itemsWithChildren)) {
              setItems(itemsWithChildren);
              prevItemsRef.current = [];
              prevCurrentTreeRef.current = currentTree;
              setIsLoading(false);

            } else {
              throw new Error('取得したデータがTreeItem[]型ではありません。');
            }
          } else {
            // データが存在しない場合にのみinitialItemsを使用
            //setItems(initialItems);
          }
        }, (error) => {
          console.log('表示中のツリーが他のユーザーまたはシステムによって削除された可能性があります。', error);
          setCurrentTreeName(null);
          setCurrentTreeMembers(null);
          setItems([]);
          setCurrentTree(null);
          setIsLoading(false);
        });

        // ツリー名のデータベースの変更をリアルタイムで監視
        const treeNameRef = ref(db, `trees/${currentTree}/name`);
        const unsubscribeName = onValue(treeNameRef, (snapshot) => {
          if (snapshot.exists()) {
            setCurrentTreeName(snapshot.val());
          } else {
            setCurrentTreeName(null);
          }
        });

        // ツリーメンバーのデータベースの変更をリアルタイムで監視
        const treeMembersRef = ref(db, `trees/${currentTree}/members`);
        const unsubscribeMembers = onValue(treeMembersRef, (snapshot) => {
          if (snapshot.exists()) {
            const membersObject = snapshot.val();
            const uids = Object.keys(membersObject); // UIDのリストを取得

            // UIDリストを使用して、メールアドレスを取得
            getMemberEmails(uids).then((result) => {
              // result.emailsには、UIDに対応するメールアドレスの配列が含まれます。
              const emails = result;
              // メンバーリストとメールアドレスを組み合わせてオブジェクトの配列を作成
              const membersWithEmails = uids.map((uid, index) => ({
                uid,
                email: emails[index] // 対応するメールアドレス
              }));
              setCurrentTreeMembers(membersWithEmails);
            });
          } else {
            setCurrentTreeMembers(null);
          }
        });

        // クリーンアップ関数
        return () => {
          unsubscribeItems();
          unsubscribeName();
          unsubscribeMembers();
        };
      } catch (error) {
        handleError('ツリーリストの変更をデータベースに保存できませんでした。' + error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTree]);

  // DB側のツリーリストにあるすべてのツリー名の変更を監視→変更されたらツリーリストを更新 ---------------------------------------------------------------------------
  useEffect(() => {
    if (treesList.length === 0) {
      return;
    }
    const unsubscribeTreeNames = treesList.map(tree => {
      const treeNameRef = ref(getDatabase(), `trees/${tree.id}/name`);
      return onValue(treeNameRef, (snapshot) => {
        if (snapshot.exists()) {
          const updatedTreesList = treesList.map((t) =>
            t.id === tree.id ? { ...t, name: snapshot.val() as string } : t
          );
          // 現在のtreesListと更新後のtreesListが異なる場合のみ更新
          if (JSON.stringify(treesList) !== JSON.stringify(updatedTreesList)) {
            setTreesList(updatedTreesList);
          }
        }
      });
    });

    return () => {
      unsubscribeTreeNames.forEach(unsubscribe => unsubscribe());
    };
  }, [treesList, setTreesList]);

  // ローカルitemsの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    // ツリー変更時には前回のitemsを保存して終了
    if (prevItemsRef.current.length === 0) {
      prevItemsRef.current = items;
      return;
    }
    const debounceSave = setTimeout(() => {
      if (!getAuth().currentUser || !currentTree) {
        return;
      }
      try {
        saveItemsDb(items, currentTree);
        prevItemsRef.current = items;
      } catch (error) {
        handleError('ツリー内容の変更をデータベースに保存できませんでした。' + error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);


  // 見つからないツリーがあった場合、ユーザーに通知してデータベース側を更新 ---------------------------------------------------------------------------
  useEffect(() => {
    const asyncFunc = async () => {
      if (missingTrees) {
        showDialog('1つ以上のツリーが他のユーザーまたはシステムによって削除されました。' + missingTrees, 'Information');
        const user = getAuth().currentUser;
        if (!user) {
          return;
        }
        const userTreeListRef = ref(getDatabase(), `users/${user.uid}/treeList`);
        onValue(userTreeListRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data: UniqueIdentifier[] = snapshot.val();
            const newTreeList = data.filter((id) => !missingTrees.includes(id.toString()));
            await set(userTreeListRef, newTreeList);
          }
        }, { onlyOnce: true }); // Add { onlyOnce: true } to ensure this listener is invoked once
        setMissingTrees(null);
      }
    }
    asyncFunc();
  }, [missingTrees, showDialog]);


  // メンバーリストからメールアドレスリストを取得する ---------------------------------------------------------------------------
  const getMemberEmails = useCallback(async (memberList: string[]) => {
    const functions = getFunctions();
    const getUserEmails = httpsCallable(functions, 'getUserEmails');

    try {
      const result = await getUserEmails({ userIds: memberList });
      // レスポンスの処理
      const emails = (result.data as { emails: string[] }).emails;
      return emails; // ここでemailsを返す
    } catch (error) {
      showDialog('メンバーのメールアドレスの取得に失敗しました。' + error, 'Error');
      return []; // エラーが発生した場合は空の配列を返す
    }
  }, [showDialog]);


  //ツリーを削除する関数 ---------------------------------------------------------------------------
  const deleteTree = async (treeId: UniqueIdentifier) => {
    const user = getAuth().currentUser;
    const db = getDatabase();
    if (!user || !db) {
      return;
    }
    setCurrentTree(null);
    setCurrentTreeName(null);
    setCurrentTreeMembers(null);
    setItems([]);
    setIsAccordionExpanded(false);

    const treeRef = ref(db, `trees/${treeId}`);

    try {
      await set(treeRef, null);
      const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
      const snapshot = await get(userTreeListRef);
      if (snapshot.exists()) {
        const data: UniqueIdentifier[] = snapshot.val();
        const newTreeList = data.filter((id) => id !== treeId);
        await set(userTreeListRef, newTreeList);
      }
      const updatedTreesList = treesList ? treesList.filter((tree) => tree.id !== treeId) : [];
      setTreesList(updatedTreesList);
      saveTreesListDb(updatedTreesList);

    } catch (error) {
      await showDialog('ツリーの削除に失敗しました。' + error, 'Error');
    }
  };


  // サーバに新しいツリーを保存する関数 ---------------------------------------------------------------------------
  const saveNewTree = useCallback(async (items: TreeItem[], name: string, members: { [key: string]: boolean }) => {
    const functions = getFunctions();
    const createNewTree = httpsCallable(functions, 'createNewTree');

    try {
      const result = await createNewTree({
        items: items.map(item => ({
          id: item.id.toString(), // idをstringにキャスト
          children: item.children, // childrenは再帰的に同様に処理する必要がある場合があります
          value: item.value,
          collapsed: item.collapsed,
          done: item.done
        })),
        name: name,
        members: members,
      });
      const treeId: string = result.data as string; // result.dataをstring型としてキャスト
      return treeId;
    } catch (error) {
      showDialog('メンバーのメールアドレスの取得に失敗しました。' + error, 'Error');
      return []; // エラーが発生した場合は空の配列を返す
    }
  }, [showDialog]);


  // 新しいツリーを作成する ---------------------------------------------------------------------------
  const handleCreateNewTree = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }

    setCurrentTree(null);
    setIsLoading(true);

    try {
      const newTreeRef: unknown = await saveNewTree(initialItems, '新しいツリー', { [user?.uid]: true, })
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
      }

      //タイマーをクリア
      return () => clearTimeout(timerOne);
    } catch (error) {
      await showDialog('新しいツリーの作成に失敗しました。' + error, 'Error');
      setIsLoading(false);
    }
  };

  // ツリーのリストから選択されたツリーを表示する
  const handleListClick = (treeId: UniqueIdentifier) => {
    setCurrentTree(treeId);
    if (isAccordionExpanded) {
      // 0.5秒後にフォーカスをセット
      const timerTwo = setTimeout(() => {
        setIsFocusedTreeName(true);
      }, 500);
      //タイマーをクリア
      return () => clearTimeout(timerTwo);
    }
  };

  // ファイルを読み込んでアプリの状態を復元する ---------------------------------------------------------------------------
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }

    setCurrentTree(null);

    const file = event.target.files?.[0];
    if (!file) {
      await showDialog('ファイルが選択されていません。', 'Information');
      return;
    }

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      try {
        const appState = JSON.parse(text as string);
        if (!isValidAppState(appState)) {
          await showDialog('無効なファイル形式です。', 'Error');
          return;
        } else {
          let treeName: string = '';
          if (!appState.currentTreeName) {
            treeName = '読み込まれたツリー';
          } else {
            treeName = appState.currentTreeName;
          }
          const newTreeRef: unknown = await saveNewTree(appState.items, treeName, { [user.uid]: true, },);

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
          const result = await showDialog('ファイルが正常に読み込まれました。', 'Information');
          if (result && treeName === '読み込まれたツリー') {
            setIsAccordionExpanded(true);
            // 0.7秒後にフォーカスをセット
            const timerTwo = setTimeout(() => {
              setIsFocusedTreeName(true);
            }, 700);
            return () => clearTimeout(timerTwo);
          }
        }
      } catch (error) {
        await showDialog('ファイルの読み込みに失敗しました。', 'Error');
      }
    };
    reader.readAsText(file);
  };

  return { deleteTree, handleCreateNewTree, handleListClick, handleFileUpload };
}