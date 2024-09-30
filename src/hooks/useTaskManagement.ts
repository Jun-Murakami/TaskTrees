import { useCallback } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreeItems } from '../types/types';
import {
  findMaxId,
  removeItem,
  findItemDeep,
  findParentItem,
  isDescendantOfTrash,
  setProperty,
  ensureChildrenProperty,
  isTreeItemArray,
  extractSubtree,
} from '@/features/sortableTree/utilities';
import { ref, getDatabase, get, set } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSync } from '@/hooks/useSync';
import { useAttachedFile } from '@/features/sortableTree/hooks/useAttachedFile';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useAppStateStore } from '@/store/appStateStore';
import { useDialogStore } from '@/store/dialogStore';

// タスクの追加、削除、復元、コピー、移動、done状態の変更を行う
// 一部にデータベースの処理を含む

export const useTaskManagement = () => {
  const setItems = useTreeStateStore((state) => state.setItems);
  const showDialog = useDialogStore((state) => state.showDialog);

  const setIsLoading = useAppStateStore((state) => state.setIsLoading);

  const { deleteFile } = useAttachedFile();
  const { updateTimeStamp, copyTreeDataToIdbFromDb } = useSync();

  // タスクを追加する ------------------------------
  // ※ SortableTreeコンポーネントに移動した

  // アイテムのテキスト値を変更する ------------------------------
  const handleValueChange = (id: UniqueIdentifier, newValue: string) => {
    const items = useTreeStateStore.getState().items;
    const newItems = setProperty(items, id, 'value', () => newValue);
    setItems(newItems);
  }

  // タスクの削除 ------------------------------
  const handleRemove = useCallback(async (id: UniqueIdentifier | undefined) => {

    if (!id) return;
    const currentItems = useTreeStateStore.getState().items;
    const currentTree = useTreeStateStore.getState().currentTree;
    const itemToRemove = findItemDeep(currentItems, id);
    const trashItem = currentItems.find((item) => item.id === 'trash');

    if (itemToRemove && trashItem) {
      setIsLoading(true);
      const itemToRemoveCopy = { ...itemToRemove, children: [...itemToRemove.children] }; // アイテムのコピーを作成

      // 親アイテムを見つけ、そのchildrenからアイテムを削除
      const parentItem = findParentItem(currentItems, id);
      // ゴミ箱にアイテムを追加するか、元のアイテムを削除するかを決定
      if (isDescendantOfTrash(currentItems, id)) {
        try {
          // itemToRemoveCopy自身とその子孫のattachedFileをすべてリストアップ
          const attachedFiles: string[] = [];
          const listUpAttachedFiles = (item: TreeItem) => {
            if (item.attachedFile) {
              attachedFiles.push(item.attachedFile);
            }
            item.children.forEach(listUpAttachedFiles);
          };
          listUpAttachedFiles(itemToRemoveCopy);
          attachedFiles.forEach((attachedFile) => {
            if (!currentTree) {
              setIsLoading(false);
              return;
            };
            deleteFile(attachedFile, currentTree);
          });
        } catch (error) {
          showDialog('添付ファイルの削除に失敗しました。\n\n' + error, 'Error');
        }
        setItems(removeItem(currentItems, id));
        setIsLoading(false);
        return;
      } else if (parentItem) {
        parentItem.children = parentItem.children.filter((child) => child.id !== id);
      }
      // ゴミ箱にアイテムを追加
      trashItem.children = [...trashItem.children, itemToRemoveCopy];
      // 元のアイテムを削除した新しいアイテムリストを作成
      const newItems = parentItem ? currentItems : currentItems.filter((item) => item.id !== id);
      // ゴミ箱アイテムを更新
      const updatedItems = newItems.map((item) => (item.id === 'trash' ? { ...trashItem, children: trashItem.children } : item));
      setItems(updatedItems);
      setIsLoading(false);
    }
  }, [showDialog, setIsLoading, deleteFile, setItems]);

  // ゴミ箱を空にする ------------------------------
  const removeTrashDescendants = useCallback(async () => {
    const targetItems = useTreeStateStore.getState().items;
    const currentTree = useTreeStateStore.getState().currentTree;
    const result = await showDialog(
      'ゴミ箱の中のすべてのアイテムが完全に削除されます。実行しますか？',
      'Confirm Requirements',
      true
    );
    if (!result) return;
    try {
      setIsLoading(true);
      // ゴミ箱の子孫のアイテムに含まれるattachedFileをすべてリストアップ
      const itemsWithTrashDescendants = targetItems.filter(
        (item) => isDescendantOfTrash(targetItems, item.id) || item.id === 'trash'
      );
      const attachedFiles: string[] = [];
      const listUpAttachedFiles = (item: TreeItem) => {
        if (item.attachedFile) {
          attachedFiles.push(item.attachedFile);
        }
        item.children.forEach(listUpAttachedFiles);
      };
      itemsWithTrashDescendants.forEach(listUpAttachedFiles);
      attachedFiles.forEach(async (attachedFile) => {
        if (!currentTree) return;
        await deleteFile(attachedFile, currentTree, true);
      });
    } catch (error) {
      await showDialog('添付ファイルの削除に失敗しました。\n\n' + error, 'Error');
    }
    const itemsWithoutTrashDescendants = targetItems.filter(
      (item) => !isDescendantOfTrash(targetItems, item.id) || item.id === 'trash'
    );
    if (itemsWithoutTrashDescendants.find((item) => item.id === 'trash')) {
      const trashItem = itemsWithoutTrashDescendants.find((item) => item.id === 'trash');
      if (trashItem) {
        trashItem.children = [];
      }
    }
    setItems(itemsWithoutTrashDescendants);
    setIsLoading(false);
  }, [showDialog, setIsLoading, deleteFile, setItems]);

  // ゴミ箱内のdoneプロパティがtrueの完了済みタスクをすべて削除する ------------------------------
  const removeTrashDescendantsWithDone = useCallback(async () => {
    const targetItems = useTreeStateStore.getState().items;
    const currentTree = useTreeStateStore.getState().currentTree;
    const result = await showDialog(
      'ゴミ箱の中の完了済みタスクが完全に削除されます。（未完了のタスクを含むブランチは削除されません。）実行しますか？',
      'Confirm Requirements',
      true
    );
    if (!result) return;

    setIsLoading(true);

    const deleteList: string[] = [];

    const addAttachedFilesToDeleteList = async (item: TreeItem) => {
      if (item.attachedFile) {
        deleteList.push(item.attachedFile);
      }
      item.children.forEach(addAttachedFilesToDeleteList);
    };

    const removeDoneDescendants = async (items: TreeItems, parentId: UniqueIdentifier): Promise<TreeItems> => {
      const result: TreeItems = [];
      for (const item of items) {
        if (item.id === parentId) {
          const filteredChildren: TreeItem[] = [];
          for (const child of item.children) {
            if (!((child.done) && !child.children.some((grandchild) => !grandchild.done))) {
              child.children = await removeDoneDescendants(child.children, child.id);
              filteredChildren.push(child);
            } else {
              // ここで child が削除される場合、関連する非同期処理を行う
              await addAttachedFilesToDeleteList(child);
            }
          }
          item.children = filteredChildren;
        } else if (item.children.length) {
          item.children = await removeDoneDescendants(item.children, parentId);
        }
        result.push(item);
      }
      return result;
    };

    const updatedItems = await removeDoneDescendants(targetItems, 'trash');
    for (const file of deleteList) {
      if (!currentTree) return;
      await deleteFile(file, currentTree, true);
    }
    setItems(updatedItems);
    setIsLoading(false);
  }, [showDialog, setIsLoading, deleteFile, setItems]);

  // タスクをゴミ箱から復元する ------------------------------
  const handleRestore = useCallback(async (id: UniqueIdentifier) => {
    if (!id) return;
    const currentItems = useTreeStateStore.getState().items;
    const itemToRestore = findItemDeep(currentItems, id);
    const trashIndex = currentItems.find((item) => item.id === 'trash');

    if (itemToRestore && trashIndex) {
      const itemToRestoreCopy = { ...itemToRestore, children: [...itemToRestore.children] }; // アイテムのコピーを作成

      // ゴミ箱からアイテムを削除
      trashIndex.children = trashIndex.children.filter((child) => child.id !== id);

      // ゴミ箱の直前に復元アイテムを追加
      const updatedItems = currentItems
        .slice(0, currentItems.indexOf(trashIndex))
        .concat(itemToRestoreCopy)
        .concat(currentItems.slice(currentItems.indexOf(trashIndex)));

      // 復元したアイテムを更新
      setItems(updatedItems);
    }
  }, [setItems]);

  // タスクのコピー ------------------------------
  const handleCopy = useCallback(async (targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier) => {
    if (!targetTreeId || !targetTaskId) return false;
    const items = useTreeStateStore.getState().items;
    const currentTree = useTreeStateStore.getState().currentTree;
    try {
      // コピー元のアイテムをchildrenに含まれる子要素も含めて抽出し、新しいツリーを作成
      const subtree = extractSubtree(items, targetTaskId);
      if (!subtree) {
        throw new Error('コピー元のアイテムを抽出できませんでした。');
      }

      // DBからコピー先のアイテムを取得
      const treeItemsRef = ref(getDatabase(), `trees/${targetTreeId}/items`);
      await get(treeItemsRef)
        .then(async (snapshot) => {
          if (snapshot.exists()) {
            const data: TreeItem[] = snapshot.val();
            const itemsWithChildren = ensureChildrenProperty(data);
            // 取得したデータがTreeItem[]型であることを確認
            if (isTreeItemArray(itemsWithChildren)) {

              // コピー用アイテムのIDを子要素も含めてすべて振りなおす
              const newTaskIdStart = findMaxId(itemsWithChildren) + 1;
              const reIdItems = (items: TreeItems, newIdStart: number): TreeItems => {
                return items.map((item) => {
                  const newId = newIdStart + parseInt(item.id.toString());
                  return {
                    ...item,
                    id: newId.toString(),
                    children: reIdItems(item.children, newId),
                  };
                });
              };
              const reIdItemsCopy = reIdItems(subtree ? [subtree] : [], newTaskIdStart);

              // コピー用アイテムに添付ファイルがあるか確認し、あればコピー先のツリーにファイルをコピー
              const attachedFiles: string[] = [];
              const listUpAttachedFiles = (item: TreeItem) => {
                if (item.attachedFile) {
                  attachedFiles.push(item.attachedFile);
                }
                item.children.forEach(listUpAttachedFiles);
              };
              reIdItemsCopy.forEach(listUpAttachedFiles);
              if (attachedFiles.length > 0) {
                const functions = getFunctions();
                const copyFileInStorage = httpsCallable(functions, 'copyFileInStorage');
                attachedFiles.forEach(async (attachedFile) => {
                  const sourcePath = `trees/${currentTree}/${attachedFile}`;
                  const destinationPath = `trees/${targetTreeId}/${attachedFile}`;
                  try {
                    await copyFileInStorage({ sourcePath, destinationPath });
                  } catch (error) {
                    throw new Error('添付ファイルのコピーに失敗しました。\n\n' + error);
                  }
                });
              }

              // ゴミ箱の直前にコピー用アイテムを追加
              const trashIndex = itemsWithChildren.find((item) => item.id === 'trash');
              const newItems = trashIndex
                ? itemsWithChildren
                  .slice(0, itemsWithChildren.indexOf(trashIndex))
                  .concat(reIdItemsCopy)
                  .concat(itemsWithChildren.slice(itemsWithChildren.indexOf(trashIndex)))
                : itemsWithChildren.concat(reIdItemsCopy);
              if (newItems && trashIndex) {
                if (targetTreeId === currentTree) {
                  setItems(newItems);
                } else {
                  //コピー先のDBにコピー用アイテムを追加
                  await set(treeItemsRef, newItems).catch((error) => {
                    throw new Error('データベースにアイテムを保存できませんでした。\n\n' + error);
                  });
                  await copyTreeDataToIdbFromDb(targetTreeId);
                  await updateTimeStamp(targetTreeId);
                }
                return true;
              } else {
                throw new Error('コピー用アイテムの抽出に失敗しました。');
              }
            } else {
              throw new Error('データベースから取得したデータがTreeItem[]型ではありません。');
            }
          } else {
            throw new Error('データベースからコピー先のアイテムを取得できませんでした。');
          }
        })
        .catch((error) => {
          throw new Error(error);
        });
    } catch (error) {
      console.error('エラーが発生しました。\n\n' + error);
      await showDialog('エラーが発生しました。\n\n' + error, 'Error');
      return false;
    }
    return false;
  }, [showDialog, setItems, updateTimeStamp, copyTreeDataToIdbFromDb]);

  // タスクの移動 ------------------------------
  const handleMove = useCallback(async (targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier) => {
    const items = useTreeStateStore.getState().items;
    const currentTree = useTreeStateStore.getState().currentTree;
    if (!targetTreeId || !targetTaskId || !currentTree) return;

    try {
      // 移動元のアイテムをchildrenに含まれる子要素も含めて抽出し、新しいツリーを作成
      const subtree = extractSubtree(items, targetTaskId);
      if (!subtree) {
        throw new Error('移動元のアイテムを抽出できませんでした。');
      }

      // DBから移動先のアイテムを取得
      const treeItemsRef = ref(getDatabase(), `trees/${targetTreeId}/items`);
      await get(treeItemsRef)
        .then(async (snapshot) => {
          if (snapshot.exists()) {
            const data: TreeItem[] = snapshot.val();
            const itemsWithChildren = ensureChildrenProperty(data);
            // 取得したデータがTreeItem[]型であることを確認
            if (isTreeItemArray(itemsWithChildren)) {

              // 移動用アイテムのIDを子要素も含めてすべて振りなおす
              const newTaskIdStart = findMaxId(itemsWithChildren) + 1;
              const reIdItems = (items: TreeItems, newIdStart: number): TreeItems => {
                return items.map((item) => {
                  const newId = newIdStart + parseInt(item.id.toString());
                  return {
                    ...item,
                    id: newId.toString(),
                    children: reIdItems(item.children, newId),
                  };
                });
              };
              const reIdItemsCopy = reIdItems(subtree ? [subtree] : [], newTaskIdStart);

              // 移動用アイテムに添付ファイルがあるか確認し、あれば移動先のツリーにファイルをコピー
              const attachedFiles: string[] = [];
              const listUpAttachedFiles = (item: TreeItem) => {
                if (item.attachedFile) {
                  attachedFiles.push(item.attachedFile);
                }
                item.children.forEach(listUpAttachedFiles);
              };
              reIdItemsCopy.forEach(listUpAttachedFiles);
              if (attachedFiles.length > 0) {
                const functions = getFunctions();
                const copyFileInStorage = httpsCallable(functions, 'copyFileInStorage');
                attachedFiles.forEach(async (attachedFile) => {
                  const sourcePath = `trees/${currentTree}/${attachedFile}`;
                  const destinationPath = `trees/${targetTreeId}/${attachedFile}`;
                  try {
                    await copyFileInStorage({ sourcePath, destinationPath });
                    await deleteFile(attachedFile, currentTree, true);
                  } catch (error) {
                    throw new Error('添付ファイルのコピーに失敗しました。\n\n' + error);
                  }
                });
              }

              // ゴミ箱の直前に移動用アイテムを追加
              const trashIndex = itemsWithChildren.find((item) => item.id === 'trash');
              const newItems = trashIndex
                ? itemsWithChildren
                  .slice(0, itemsWithChildren.indexOf(trashIndex))
                  .concat(reIdItemsCopy)
                  .concat(itemsWithChildren.slice(itemsWithChildren.indexOf(trashIndex)))
                : itemsWithChildren.concat(reIdItemsCopy);

              if (newItems && trashIndex) {
                //移動先のDBにアイテムを追加
                await set(treeItemsRef, newItems).catch((error) => {
                  throw new Error('データベースにアイテムを保存できませんでした。\n\n' + error);
                });
                await updateTimeStamp(targetTreeId);
                await copyTreeDataToIdbFromDb(targetTreeId);
                setItems(removeItem(items, targetTaskId));
              } else {
                throw new Error('移動用アイテムの抽出に失敗しました。');
              }
            } else {
              throw new Error('データベースから取得したデータがTreeItem[]型ではありません。');
            }
          } else {
            throw new Error('データベースから移動先のアイテムを取得できませんでした。');
          }
        })
        .catch((error) => {
          throw new Error(error);
        });
    } catch (error) {
      console.error('エラーが発生しました。\n\n' + error);
      await showDialog('エラーが発生しました。\n\n' + error, 'Error');
    }
  }, [showDialog, setItems, updateTimeStamp, copyTreeDataToIdbFromDb, deleteFile]);

  // アイテムのdone状態を変更する ------------------------------
  // 子孫のdone状態を更新する
  const updateChildrenDone = useCallback((items: TreeItems, targetId: UniqueIdentifier, done: boolean): TreeItems => {
    return items.map((item) => {
      // アイテム自体かその子孫が対象のIDと一致する場合、done状態を更新
      if (item.id === targetId) {
        const updateItemDone = (item: (typeof items)[number]): typeof item => ({
          ...item,
          done,
          children: item.children.map(updateItemDone),
        });
        return updateItemDone(item);
      } else if (item.children) {
        return { ...item, children: updateChildrenDone(item.children, targetId, done) };
      }
      return item;
    });
  }, []);

  // 本編
  const handleDoneChange = useCallback((id: UniqueIdentifier, done: boolean) => {
    const currentItems = useTreeStateStore.getState().items;
    // アイテム自体のdone状態を更新
    const updatedItems = setProperty(currentItems, id, 'done', () => done);
    // 子要素のdone状態も更新
    const newItems = updateChildrenDone(updatedItems, id, done);
    setItems(newItems);
  }, [updateChildrenDone, setItems]);

  // アイテムにファイルを添付する ------------------------------
  const handleAttachFile = useCallback((id: UniqueIdentifier, fileName: string) => {
    const currentItems = useTreeStateStore.getState().items;
    const newItems = setProperty(currentItems, id, 'attachedFile', () => fileName);
    setItems(newItems);
  }, [setItems]);

  // アイテムにタイマーをセットする ------------------------------
  const handleSetTimer = useCallback((id: UniqueIdentifier, timer: string | undefined, isUpLift: boolean | undefined, upLiftMinute: number | undefined, isNotify: boolean | undefined, notifyMinute: number | undefined) => {
    const currentItems = useTreeStateStore.getState().items;
    const setTimer = (items: TreeItems, id: UniqueIdentifier, timer: string | undefined, isUpLift: boolean | undefined, upLiftMinute: number | undefined, isNotify: boolean | undefined, notifyMinute: number | undefined): TreeItems => {
      return items.map((item) => {
        if (item.id === id) {
          return { ...item, ['timer']: timer, ['isUpLift']: isUpLift, ['upLiftMinute']: upLiftMinute, ['isNotify']: isNotify, ['notifyMinute']: notifyMinute };
        } else if (item.children.length) {
          return { ...item, children: setTimer(item.children, id, timer, isUpLift, upLiftMinute, isNotify, notifyMinute) };
        }
        return item;
      })
    }
    const newItems = setTimer(currentItems, id, timer ? timer : undefined, isUpLift ? isUpLift : undefined, upLiftMinute ? upLiftMinute : undefined, isNotify ? isNotify : undefined, notifyMinute ? notifyMinute : undefined);
    setItems(newItems);
  }, [setItems]);

  return {
    handleRemove,
    handleValueChange,
    handleDoneChange,
    handleCopy,
    handleMove,
    handleRestore,
    handleAttachFile,
    handleSetTimer,
    removeTrashDescendants,
    removeTrashDescendantsWithDone,
  };
};
