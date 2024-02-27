import { useEffect, useCallback, useState, useRef } from 'react';
import { TreeItem, TreesList } from '../types/types';
import { isTreeItemArray, isValidAppState } from '../components/SortableTree/utilities';
import { initialItems } from '../components/SortableTree/mock';
import { Auth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, set, get } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useDialogStore } from '../store/dialogStore';
import { UniqueIdentifier } from '@dnd-kit/core';

export const useTreeManagement = (auth: Auth,) => {
  const [isLoadedItemsFromExternal, setIsLoadedItemsFromExternal] = useState(false);
  const [missingTrees, setMissingTrees] = useState<string[] | null>(null);

  const setSystemMessage = useAppStateStore((state) => state.setSystemMessage);
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);
  const setIsLoggedIn = useAppStateStore((state) => state.setIsLoggedIn);
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

  const showDialog = useDialogStore((state) => state.showDialog);

  // ツリーリストの監視用フラグ
  const isInternalUpdateRef = useRef(false);
  const isExternalUpdateRef = useRef(false);



  // エラーハンドリング ---------------------------------------------------------------------------
  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      setSystemMessage('ログアウトしました。 : ' + error.message);
    } else {
      setSystemMessage('ログアウトしました。: ' + error);
    }
    setCurrentTree(null);
    setCurrentTreeName(null);
    setCurrentTreeMembers(null);
    setItems([]);
    setIsAccordionExpanded(false);
    signOut(auth);
    setIsLoggedIn(false);
    if (setIsLoading) setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSystemMessage, setItems, setIsLoggedIn, setIsLoading, auth]);

  // 保存時に削除されたitemsのchildrenプロパティを復元
  function ensureChildrenProperty(items: TreeItem[]): TreeItem[] {
    return items.map(item => ({
      ...item,
      children: item.children ? ensureChildrenProperty(item.children) : []
    }));
  }

  // ツリーリストの監視→変更されたらツリーリストを更新 ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const user = auth.currentUser;
      if (!user || !isLoggedIn) {
        return;
      }
      setIsLoading(true);
      const db = getDatabase();
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

            if (isInternalUpdateRef.current) {
              isInternalUpdateRef.current = false;
              return;
            }
            isExternalUpdateRef.current = true;
            setTreesList(treesListAccumulator);
          });
        } else {
          setIsLoading(false);

          setTreesList([]);
          if (isInternalUpdateRef.current) {
            isInternalUpdateRef.current = false;
            return;
          }
          isExternalUpdateRef.current = true;
        }
      });

      return () => unsubscribe();
    } catch (error) {
      setIsLoading(false);
      handleError('ツリーリストの監視中にエラーが発生しました' + error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, missingTrees]);


  const prevCurrentTreeRef = useRef<UniqueIdentifier | null>(null);
  const prevItemsRef = useRef<TreeItem[]>([]);

  // 現在のツリーIDの監視→変更されたらitemsをデータベースから取得 ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentTree) {
      setIsLoading(true);
      // currentTreeが変更されたときに前のcurrentTreeのitemsを保存
      if (prevCurrentTreeRef.current && prevCurrentTreeRef.current !== currentTree && prevItemsRef.current !== items) {
        const db = getDatabase();
        const treeStateRef = ref(db, `trees/${prevCurrentTreeRef.current}/items`);
        // 更新対象が存在するかチェック
        get(treeStateRef).then((snapshot) => {
          if (snapshot.exists()) {
            // 存在する場合、更新を実行
            set(treeStateRef, items).catch((error) => { handleError('前回のツリー内容の変更をデータベースに保存できませんでした。code:1 ' + error), console.log('前回のツリー内容の変更をデータベースに保存できませんでした。code:1 ' + error) });

          } else {
            // 存在しない場合、エラーハンドリング
            console.log('更新対象のツリーが存在しません。');
          }
        }).catch((error) => { console.log('前回のツリー内容の変更は破棄されました。code:2 ' + error) });
      }
      // 現在のcurrentTreeをprevCurrentTreeRefに保存
      prevCurrentTreeRef.current = currentTree;

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('ユーザーがログインしていません。');
        }
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
              setIsLoadedItemsFromExternal(true);
              if (setIsLoading) setIsLoading(false);
              setItems(itemsWithChildren);
              prevItemsRef.current = itemsWithChildren;
            } else {
              throw new Error('取得したデータがTreeItem[]型ではありません。');
            }
          } else {
            // データが存在しない場合にのみinitialItemsを使用
            //setItems(initialItems);
            if (setIsLoading) setIsLoading(false);
          }
        }, (error) => {
          // エラーハンドリングをここに追加
          if (setIsLoading) setIsLoading(false);
          console.log('表示中のツリーが他のユーザーまたはシステムによって削除された可能性があります。', error);
          setCurrentTreeName(null);
          setCurrentTreeMembers(null);
          setItems([]);
          setCurrentTree(null);
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
        handleError('ツリーリストの変更をデータベースに保存できませんでした。' + error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTree]);

  // itemsの変更をデータベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    const debounceSave = setTimeout(() => {
      const user = auth.currentUser;
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
        handleError('ツリー内容の変更をデータベースに保存できませんでした。' + error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, handleError]);


  // treesListの変更をデータベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || treesList.length === 0) {
      return;
    }
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false;
      return;
    }
    try {
      isInternalUpdateRef.current = true;
      const db = getDatabase();
      const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
      set(userTreeListRef, treesList.map((tree) => tree.id));
    } catch (error) {
      isInternalUpdateRef.current = false;
      handleError('ツリーリストの変更をデータベースに保存できませんでした。' + error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treesList]);

  // ツリー名の変更を監視→変更されたらツリーリストを更新 ---------------------------------------------------------------------------
  useEffect(() => {
    if (treesList.length === 0) {
      return;
    }
    const db = getDatabase();
    const unsubscribeTreeNames = treesList.map(tree => {
      const treeNameRef = ref(db, `trees/${tree.id}/name`);
      return onValue(treeNameRef, (snapshot) => {
        if (snapshot.exists()) {
          const currentTreesList = useTreeStateStore.getState().treesList;
          const updatedTreesList = currentTreesList.map((t) =>
            t.id === tree.id ? { ...t, name: snapshot.val() as string } : t
          );
          // 現在のtreesListと更新後のtreesListが異なる場合のみ更新
          if (JSON.stringify(currentTreesList) !== JSON.stringify(updatedTreesList)) {
            setTreesList(updatedTreesList);
          }
        }
      });
    });

    return () => {
      unsubscribeTreeNames.forEach(unsubscribe => unsubscribe());
    };
  }, [treesList, setTreesList]);


  // 見つからないツリーがあった場合、ユーザーに通知してデータベース側を更新 ---------------------------------------------------------------------------
  useEffect(() => {
    const asyncFunc = async () => {
      if (missingTrees) {
        isInternalUpdateRef.current = true;
        showDialog('1つ以上のツリーが他のユーザーまたはシステムによって削除されました。' + missingTrees, 'Information');
        const user = auth.currentUser;
        if (!user) {
          return;
        }
        const db = getDatabase();
        const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
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
  }, [missingTrees, showDialog, auth]);

  // currentTreeNameの変更をデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveCurrentTreeName = (editedTreeName: string) => {
    const user = auth.currentUser;
    if (!user || !currentTree) {
      return;
    }
    try {
      const db = getDatabase();
      const treeNameRef = ref(db, `trees/${currentTree}/name`);
      set(treeNameRef, editedTreeName);
    } catch (error) {
      handleError('ツリー名の変更をデータベースに保存できませんでした。' + error);
    }
  };

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
    const user = auth.currentUser;
    if (!user) {
      return;
    }
    setCurrentTree(null);
    setCurrentTreeName(null);
    setCurrentTreeMembers(null);
    setItems([]);
    setIsAccordionExpanded(false);

    isInternalUpdateRef.current = true;

    const db = getDatabase();
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

    } catch (error) {
      isInternalUpdateRef.current = false;
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

  // 新しいツリーを作成する関数 ---------------------------------------------------------------------------
  const handleCreateNewTree = async () => {
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    setCurrentTree(null);
    setIsLoading(true);

    try {
      isInternalUpdateRef.current = true;
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
        const updatedTreesListWithNewTree = treesList ? [newTree, ...treesList] : [newTree];
        setTreesList(updatedTreesListWithNewTree);
      }

      //タイマーをクリア
      return () => clearTimeout(timerOne);
    } catch (error) {
      isInternalUpdateRef.current = false;
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
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    setCurrentTree(null);

    const file = event.target.files?.[0];
    if (!file) {
      await showDialog('ファイルが選択されていません。', 'Information');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      try {
        const appState = JSON.parse(text as string);
        if (!isValidAppState(appState)) {
          await showDialog('無効なファイル形式です。', 'Error');
          return;
        } else {
          isInternalUpdateRef.current = true;
          let treeName: string = '';
          if (!appState.currentTreeName) {
            treeName = '読み込まれたツリー';
          } else {
            treeName = appState.currentTreeName;
          }
          const newTreeRef: unknown = await saveNewTree(appState.items, treeName, { [user?.uid]: true, },);

          if (!newTreeRef) {
            throw new Error('ツリーのデータベースへの保存に失敗しました。');
          }

          setCurrentTree(newTreeRef as UniqueIdentifier);
          setCurrentTreeName(treeName);
          const loadedTreeObject = { id: newTreeRef as UniqueIdentifier, name: treeName };
          const updatedTreesListWithLoadedTree = treesList ? [loadedTreeObject, ...treesList] : [loadedTreeObject];
          setTreesList(updatedTreesListWithLoadedTree);
          const result = await showDialog('ファイルが正常に読み込まれました。', 'Information');
          if (result) {
            setIsAccordionExpanded(true);
            // 0.7秒後にフォーカスをセット
            const timerTwo = setTimeout(() => {
              setIsFocusedTreeName(true);
            }, 700);
            return () => clearTimeout(timerTwo);
          }
          if (user.email) {
            setCurrentTreeMembers([{ uid: user.uid, email: user.email }]);
          } else {
            setCurrentTreeMembers([{ uid: user.uid, email: 'unknown' }]);
          }
          setItems(appState.items);
        }
      } catch (error) {
        await showDialog('ファイルの読み込みに失敗しました。', 'Error');
        isInternalUpdateRef.current = false;
      }
    };
    reader.readAsText(file);
  };

  return { saveCurrentTreeName, deleteTree, handleCreateNewTree, handleListClick, handleFileUpload };
}