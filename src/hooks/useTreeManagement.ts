import { useEffect, useCallback, useState, useRef } from 'react';
import { TreeItem, TreesList } from '../types/types';
import { isTreeItemArray } from '../components/SortableTree/utilities';
import { initialItems } from '../components/SortableTree/mock';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, set, push } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useDialogStore } from '../store/dialogStore';
import { UniqueIdentifier } from '@dnd-kit/core';

export const useTreeManagement = (
  items: TreeItem[],
  setItems: React.Dispatch<React.SetStateAction<TreeItem[]>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>,
  isLoggedIn: boolean,
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  currentTree: UniqueIdentifier | null,
  setCurrentTree: React.Dispatch<React.SetStateAction<UniqueIdentifier | null>>,
  setCurrentTreeName: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentTreeMembers: React.Dispatch<React.SetStateAction<{ uid: string; email: string }[] | null>>,
  treesList: TreesList,
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>,
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const [isLoadedItemsFromExternal, setIsLoadedItemsFromExternal] = useState(false);
  const [isLoadedTreesListFromExternal, setIsLoadedTreesListFromExternal] = useState(false);
  const [MissingTrees, setMissingTrees] = useState<string[] | null>(null);
  const showDialog = useDialogStore((state) => state.showDialog);

  // エラーハンドリング
  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      setMessage('ログアウトしました。 : ' + error.message);
    } else {
      setMessage('ログアウトしました。不明なエラーが発生しました。');
    }
    setItems([]);
    signOut(getAuth());
    setIsLoggedIn(false);
    if (setIsLoading) setIsLoading(false);
  }, [setMessage, setItems, setIsLoggedIn, setIsLoading]);

  // 保存時に削除されたitemsのchildrenプロパティを復元
  function ensureChildrenProperty(items: TreeItem[]): TreeItem[] {
    return items.map(item => ({
      ...item,
      children: item.children ? ensureChildrenProperty(item.children) : []
    }));
  }

  // ツリーリストの監視→変更されたらツリーリストを更新
  useEffect(() => {
    try {
      const user = getAuth().currentUser;
      if (!user || !isLoggedIn) {
        return;
      }
      const db = getDatabase();
      const treeListRef = ref(db, `users/${user.uid}/treeList`);
      // データベース側の変更を監視し、変更があればツリーリストを更新。タイトルは別途取得
      const unsubscribe = onValue(treeListRef, (snapshot) => {
        if (snapshot.exists()) {
          const data: string[] = snapshot.val();
          let treesListAccumulator: TreesList = []; // 空の配列で初期化
          const promises = data.map((treeId) =>
            new Promise<void>((resolve) => {
              const treeTitleRef = ref(db, `trees/${treeId}/name`);
              onValue(treeTitleRef, (snapshot) => {
                if (snapshot.exists() && treesListAccumulator !== null) {
                  treesListAccumulator = [...treesListAccumulator, { id: treeId, name: snapshot.val() }];
                }
                // データが存在しない場合もresolveを呼び出して、次の処理に進む
                if (!snapshot.exists()) {
                  setMissingTrees((prev) => prev ? [...prev, treeId] : [treeId]);
                }
                resolve();
              }, {
                onlyOnce: true // リスナーを一回限りにする
              });
            })
          );

          Promise.all(promises).then(async (): Promise<void> => {
            setTreesList(treesListAccumulator); // 全てのプロミスが解決された後に更新
            setIsLoadedTreesListFromExternal(true);
          });
        } else {
          setTreesList([]); // スナップショットが存在しない場合は空をセット
          setIsLoadedTreesListFromExternal(true);
        }
      });

      return () => unsubscribe(); // クリーンアップ関数
    } catch (error) {
      handleError(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, setTreesList, handleError, showDialog]);

  const prevCurrentTreeRef = useRef<UniqueIdentifier | null>(null);
  const prevItemsRef = useRef<TreeItem[]>([]);

  // 現在のツリーIDの監視→変更されたらitemsをデータベースから取得
  useEffect(() => {
    if (currentTree) {
      // currentTreeが変更されたときに前のcurrentTreeのitemsを保存
      if (prevCurrentTreeRef.current && prevCurrentTreeRef.current !== currentTree && prevItemsRef.current !== items) {
        const db = getDatabase();
        const treeStateRef = ref(db, `trees/${prevCurrentTreeRef.current}/items`);
        set(treeStateRef, items).catch(handleError);
      }
      // 現在のcurrentTreeをprevCurrentTreeRefに保存
      prevCurrentTreeRef.current = currentTree;

      try {
        const user = getAuth().currentUser;
        if (!user) {
          throw new Error('ユーザーがログインしていません。');
        }
        setIsLoading(true);
        const db = getDatabase();

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
              prevItemsRef.current = itemsWithChildren;
            } else {
              throw new Error('取得したデータがTreeItem[]型ではありません。');
            }
            setIsLoadedItemsFromExternal(true);
            if (setIsLoading) setIsLoading(false);
          } else {
            // データが存在しない場合にのみinitialItemsを使用
            //setItems(initialItems);
            if (setIsLoading) setIsLoading(false);
          }
        }, (error) => {
          // エラーハンドリングをここに追加
          if (setIsLoading) setIsLoading(false);
          handleError(error);
        });

        // ツリー名のデータベースの変更をリアルタイムで監視
        const treeNameRef = ref(db, `trees/${currentTree}/name`);
        const unsubscribeName = onValue(treeNameRef, (snapshot) => {
          if (snapshot.exists()) {
            setCurrentTreeName(snapshot.val());
            if (setIsLoading) setIsLoading(false);
          } else {
            setCurrentTreeName(null);
            if (setIsLoading) setIsLoading(false);
          }
        });

        // ツリーメンバーのデータベースの変更をリアルタイムで監視
        const treeMembersRef = ref(db, `trees/${currentTree}/members`);
        const unsubscribeMembers = onValue(treeMembersRef, (snapshot) => {
          if (snapshot.exists()) {
            const data: string[] = snapshot.val();
            // メールアドレスリストを取得して、メンバーリストdataと合体して辞書型リストにしてセット
            getMemberEmails(data).then((emails) => {
              setCurrentTreeMembers(data.map((uid, index) => ({ uid, email: emails[index] })));
            });
            if (setIsLoading) setIsLoading(false);
          } else {
            setCurrentTreeMembers(null);
            if (setIsLoading) setIsLoading(false);
          }
        });

        // クリーンアップ関数
        return () => {
          unsubscribeItems();
          unsubscribeName();
          unsubscribeMembers();
        };
      } catch (error) {
        if (setIsLoading) setIsLoading(false);
        handleError(error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTree]);

  // itemsの変更をデータベースに保存
  useEffect(() => {
    const debounceSave = setTimeout(() => {
      const user = getAuth().currentUser;
      if (!user || !currentTree) {
        return;
      }
      if (isLoadedItemsFromExternal) {
        setIsLoadedItemsFromExternal(false);
        return;
      }
      try {
        const db = getDatabase();
        const treeStateRef = ref(db, `trees/${currentTree}/items`);
        set(treeStateRef, items);
      } catch (error) {
        handleError(error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, handleError]);


  // treesListの変更をデータベースに保存
  useEffect(() => {
    const debounceSave = setTimeout(() => {
      const user = getAuth().currentUser;
      if (!user || treesList.length === 0) {
        return;
      }
      if (isLoadedTreesListFromExternal) {
        setIsLoadedTreesListFromExternal(false);
        return;
      }
      try {
        const db = getDatabase();
        const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
        set(userTreeListRef, treesList.map((tree) => tree.id));
      } catch (error) {
        handleError(error);
      }
    }, 5000); // 5秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treesList, handleError]);

  // ツリー名の変更を監視→変更されたらツリーリストを更新
  useEffect(() => {
    const db = getDatabase();
    const unsubscribeFunctions = treesList.map(tree => {
      const treeNameRef = ref(db, `trees/${tree.id}/name`);
      return onValue(treeNameRef, (snapshot) => {
        if (snapshot.exists()) {
          setTreesList((currentTreesList) =>
            currentTreesList.map((t) =>
              t.id === tree.id ? { ...t, name: snapshot.val() } : t
            )
          );
          setIsLoadedTreesListFromExternal(true);
        }
      });
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [treesList, setTreesList]);


  // 見つからないツリーがあった場合、ユーザーに通知してデータベース側を更新
  useEffect(() => {
    const asyncFunc = async () => {
      if (MissingTrees) {
        await showDialog('1つ以上のツリーが他のユーザーまたはシステムによって削除されました。\n\n' + MissingTrees, 'Information');
        const user = getAuth().currentUser;
        if (!user) {
          return;
        }
        const db = getDatabase();
        const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
        onValue(userTreeListRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data: string[] = snapshot.val();
            const newTreeList = data.filter((id) => !MissingTrees.includes(id));
            await set(userTreeListRef, newTreeList);
          }
        }, { onlyOnce: true }); // Add { onlyOnce: true } to ensure this listener is invoked once
        setMissingTrees(null);
      }
    }
    asyncFunc();
  }, [MissingTrees, showDialog]);

  // currentTreeNameの変更をデータベースに保存する関数
  const saveCurrentTreeName = (editedTreeName: string) => {
    const user = getAuth().currentUser;
    if (!user || !currentTree) {
      return;
    }
    try {
      const db = getDatabase();
      const treeNameRef = ref(db, `trees/${currentTree}/name`);
      set(treeNameRef, editedTreeName);
    } catch (error) {
      handleError(error);
    }
  };

  // メンバーリストからメールアドレスリストを取得する
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


  //ツリーを削除する関数
  const deleteTree = async (treeId: string) => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    const db = getDatabase();
    const treeRef = ref(db, `trees/${treeId}`);
    try {
      await set(treeRef, null);
      const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
      onValue(userTreeListRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data: string[] = snapshot.val();
          const newTreeList = data.filter((id) => id !== treeId);
          await set(userTreeListRef, newTreeList);
        }
      }, { onlyOnce: true }); // Add { onlyOnce: true } to ensure this listener is invoked once
      setCurrentTree(null);
      setCurrentTreeName(null);
      setCurrentTreeMembers(null);
      setItems([]);
    } catch (error) {
      await showDialog('ツリーの削除に失敗しました。' + error, 'Error');
    }
  };

  // 新しいツリーを作成する関数
  const handleCreateNewTree = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    const db = getDatabase();
    const treesRef = ref(db, 'trees');
    const newTreeRef = push(treesRef);
    await set(newTreeRef, {
      items: initialItems,
      name: '新しいツリー',
      members: [user?.uid],
    });
    setCurrentTree(newTreeRef.key);
    setCurrentTreeName('新しいツリー');
    if (user.email) {
      setCurrentTreeMembers([{ uid: user.uid, email: user.email }]);
    } else {
      setCurrentTreeMembers([{ uid: user.uid, email: 'unknown' }]);
    }
    // ツリーリストに新しいツリーを追加
    const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
    onValue(userTreeListRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data: string[] = snapshot.val();
        const newTreeList = [...data, newTreeRef.key];
        await set(userTreeListRef, newTreeList);
      } else {
        await set(userTreeListRef, [newTreeRef.key]);
      }
    }, { onlyOnce: true }); // Add { onlyOnce: true } to ensure this listener is invoked once

    // ツリーリストを更新
    setTreesList((prevTreesList) => {
      if (prevTreesList && newTreeRef.key) {
        return [...prevTreesList, { id: newTreeRef.key, name: '新しいツリー' }];
      } else {
        return prevTreesList;
      }
    });
    setIsExpanded(true);
    // 0.2秒後にフォーカスをセット
    setTimeout(() => {
      setIsFocused(true);
    }, 200);
  };

  return { saveCurrentTreeName, deleteTree, handleCreateNewTree };
}