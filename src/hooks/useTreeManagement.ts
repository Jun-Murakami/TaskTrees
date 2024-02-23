import { useEffect, useCallback, useState, useRef } from 'react';
import { TreeItem, TreesList } from '../conponents/Tree/types';
import { isTreeItemArray } from '../conponents/Tree/utilities';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useDialogStore } from '../store/dialogStore';

export const useTreeManagement = (
  items: TreeItem[],
  setItems: React.Dispatch<React.SetStateAction<TreeItem[]>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>,
  isLoggedIn: boolean,
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  currentTree: string | null,
  setCurrentTree: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentTreeName: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentTreeMembers: React.Dispatch<React.SetStateAction<string[] | null>>,
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>,
  setMembersEmails: React.Dispatch<React.SetStateAction<string[] | null>>
) => {
  const [isLoadedItemsFromExternal, setIsLoadedItemsFromExternal] = useState(false);
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
          let treesListAccumulator: TreesList = {}; // 初期化
          const promises = data.map((treeId) =>
            new Promise<void>((resolve) => {
              const treeTitleRef = ref(db, `trees/${treeId}/name`);
              onValue(treeTitleRef, (snapshot) => {
                if (snapshot.exists()) {
                  treesListAccumulator = { ...treesListAccumulator, [treeId]: snapshot.val() };
                }
                // データが存在しない場合もresolveを呼び出して、次の処理に進む
                resolve();
              }, {
                onlyOnce: true // リスナーを一回限りにする
              });
            })
          );

          Promise.all(promises).then(() => {
            setTreesList(treesListAccumulator); // 全てのプロミスが解決された後に更新
          });
        } else {
          setTreesList(null); // スナップショットが存在しない場合はnullをセット
        }
      });

      return () => unsubscribe(); // クリーンアップ関数
    } catch (error) {
      handleError(error);
    }
  }, [isLoggedIn, setTreesList, handleError]);

  const prevCurrentTreeRef = useRef<string | null>(null);
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
              getMemberEmails(currentTree).then((emails) => {
                setMembersEmails(emails || null);
              })
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
            setCurrentTreeMembers(data);
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
  }, [items, isLoadedItemsFromExternal, handleError]);

  // treesListの変更をデータベースに保存する関数
  const saveTreesList = (editedTreesList: TreesList) => {
    const user = getAuth().currentUser;
    if (!user || !editedTreesList) {
      return;
    }
    try {
      const db = getDatabase();
      const treeListRef = ref(db, `users/${user.uid}/treeList`);
      set(treeListRef, editedTreesList ? Object.keys(editedTreesList) : []);
    } catch (error) {
      handleError(error);
    }
  };

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

  // currentTreeMembersの変更をデータベースに保存する関数
  const saveCurrentTreeMembers = (editedTreeMembers: string[]) => {
    const user = getAuth().currentUser;
    if (!user || !currentTree) {
      return;
    }
    try {
      const db = getDatabase();
      const treeMembersRef = ref(db, `trees/${currentTree}/members`);
      set(treeMembersRef, editedTreeMembers);
    } catch (error) {
      handleError(error);
    }
  };

  // メンバーのメールアドレスを取得する
  const getMemberEmails = async (treeId: string) => {
    const functions = getFunctions();
    const getMemberEmailsCallable = httpsCallable(functions, 'getMemberEmails');
    try {
      const result = await getMemberEmailsCallable({ treeId });
      const data = result.data as { emails: string[] };
      return data.emails;
    } catch (error) {
      await showDialog('メンバーのメールアドレスを取得できませんでした。' + error, 'Error');
    }
  };

  //ツリーを削除する
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

  return { saveTreesList, saveCurrentTreeName, saveCurrentTreeMembers, deleteTree };
}