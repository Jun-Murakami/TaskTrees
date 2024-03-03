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
} from '../components/SortableTree/utilities';
import { ref, getDatabase, get, set } from 'firebase/database';
import { useTaskStateStore } from '../store/taskStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useDialogStore } from '../store/dialogStore';


export const useTaskManagement = () => {
  const lastSelectedItemId = useTaskStateStore((state) => state.lastSelectedItemId);
  const setLastSelectedItemId = useTaskStateStore((state) => state.setLastSelectedItemId);

  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const showDialog = useDialogStore((state) => state.showDialog);

  // 選択したアイテムのIDを記憶する
  const handleSelect = (id: UniqueIdentifier) => {
    setLastSelectedItemId(id);
  };

  // タスクを追加する ------------------------------

  // ネストされたアイテムからアイテムを検索する
  const containsItemId = (items: TreeItems, itemId: UniqueIdentifier): boolean => {
    return items.some((item) => item.id === itemId || containsItemId(item.children, itemId));
  };

  // ネストされたアイテムにアイテムを追加する
  const addItemToNestedChildren = (items: TreeItems, parentId: UniqueIdentifier, newItem: TreeItem): TreeItem[] => {
    return items.map((item) => {
      if (item.id === parentId) {
        if (!item.children) {
          item.children = [];
        }
        item.children.push(newItem);
        return item;
      } else if (item.children) {
        item.children = addItemToNestedChildren(item.children, parentId, newItem);
        return item;
      }
      return item;
    });
  };

  // 本編
  const handleAddTask = () => {
    const newTaskId = findMaxId(items) + 1;
    const newTask = {
      id: newTaskId.toString(),
      value: '',
      done: false,
      children: [],
    };

    if (
      lastSelectedItemId === 'trash' ||
      (lastSelectedItemId !== null && isDescendantOfTrash(items, lastSelectedItemId)) ||
      lastSelectedItemId === null
    ) {
      // 選択アイテムが無い場合、新しいタスクを先頭に追加
      const newItems = [...items]; // 現在のアイテムのコピーを作成
      const trashIndex = newItems.findIndex((item) => item.id === 'trash');
      if (trashIndex >= 0) {
        newItems.unshift(newTask)
      } else {
        // ゴミ箱が存在しない場合、何もしない
        console.error('ゴミ箱が存在しません');
        return;
      }
      setItems(newItems); // 更新されたアイテムの配列をセット
    } else {
      // itemsをchildren内を含めて再帰的に検索し、選択したアイテムのidが存在しない場合はツリーの最初に追加
      if (!containsItemId(items, lastSelectedItemId)) {
        const newItems = [...items]; // 現在のアイテムのコピーを作成
        newItems.unshift(newTask); // 配列の先頭に追加
        setItems(newItems); // 更新されたアイテムの配列をセット
      } else {
        // 選択したアイテムの直下に新しいアイテムを追加
        const updatedItems = addItemToNestedChildren(items, lastSelectedItemId, newTask);
        setItems(updatedItems);
      }
    }
  };

  // タスクの削除 ------------------------------
  function handleRemove(id: UniqueIdentifier | undefined) {
    if (!id) return;
    const currentItems = items;
    const itemToRemove = findItemDeep(currentItems, id);
    const trashItem = currentItems.find((item) => item.id === 'trash');

    if (itemToRemove && trashItem) {
      const itemToRemoveCopy = { ...itemToRemove, children: [...itemToRemove.children] }; // アイテムのコピーを作成

      // 親アイテムを見つけ、そのchildrenからアイテムを削除
      const parentItem = findParentItem(currentItems, id);
      // ゴミ箱にアイテムを追加するか、元のアイテムを削除するかを決定
      if (isDescendantOfTrash(currentItems, id)) {
        setItems(removeItem(currentItems, id));
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
    }
  }

  // タスクをゴミ箱から復元する ------------------------------
  const handleRestore = (id: UniqueIdentifier) => {
    if (!id) return;
    const currentItems = items;
    const itemToRestore = findItemDeep(currentItems, id);
    const trashIndex = currentItems.find((item) => item.id === 'trash');

    if (itemToRestore && trashIndex) {
      const itemToRestoreCopy = { ...itemToRestore, children: [...itemToRestore.children] }; // アイテムのコピーを作成

      // ゴミ箱からアイテムを削除
      trashIndex.children = trashIndex.children.filter((child) => child.id !== id);

      // ゴミ箱の直前に復元アイテムを追加
      const updatedItems = currentItems.slice(0, currentItems.indexOf(trashIndex)).concat(itemToRestoreCopy).concat(currentItems.slice(currentItems.indexOf(trashIndex)))

      // 復元したアイテムを更新
      setItems(updatedItems);
    }
  };

  // タスクのコピー ------------------------------
  const handleCopy = (targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier) => {
    if (!targetTreeId || !targetTaskId) return;

    try {
      // コピー元のアイテムをchildrenに含まれる子要素も含めて抽出し、新しいツリーを作成
      const subtree = extractSubtree(items, targetTaskId);
      if (!subtree) {
        throw new Error('コピー元のアイテムを抽出できませんでした。');
      }

      // DBからコピー先のアイテムを取得
      const treeItemsRef = ref(getDatabase(), `trees/${targetTreeId}/items`);
      get(treeItemsRef).then((snapshot) => {
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
            }
            const reIdItemsCopy = reIdItems(subtree ? [subtree] : [], newTaskIdStart);
            const trashIndex = itemsWithChildren.find((item) => item.id === 'trash');
            // ゴミ箱の直前にコピー用アイテムを追加
            const newItems = trashIndex ? itemsWithChildren.slice(0, itemsWithChildren.indexOf(trashIndex)).concat(reIdItemsCopy).concat(itemsWithChildren.slice(itemsWithChildren.indexOf(trashIndex))) : itemsWithChildren.concat(reIdItemsCopy);
            if (newItems && trashIndex) {
              //コピー先のDBにコピー用アイテムを追加
              set(treeItemsRef, newItems).catch((error) => {
                throw new Error('データベースにアイテムを保存できませんでした。' + error);
              });
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
      }).catch((error) => {
        throw new Error(error);
      });
    } catch (error) {
      console.error('エラーが発生しました。' + error);
      showDialog('エラーが発生しました。' + error, 'Error');
      return false;
    }
  };

  // タスクの移動 ------------------------------
  const handleMove = (targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier) => {
    if (!targetTreeId || !targetTaskId) return;

    try {
      // 移動元のアイテムをchildrenに含まれる子要素も含めて抽出し、新しいツリーを作成
      const subtree = extractSubtree(items, targetTaskId);
      if (!subtree) {
        throw new Error('移動元のアイテムを抽出できませんでした。');
      }

      // DBから移動先のアイテムを取得
      const treeItemsRef = ref(getDatabase(), `trees/${targetTreeId}/items`);
      get(treeItemsRef).then((snapshot) => {
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
            }
            const reIdItemsCopy = reIdItems(subtree ? [subtree] : [], newTaskIdStart);
            const trashIndex = itemsWithChildren.find((item) => item.id === 'trash');
            // ゴミ箱の直前に移動用アイテムを追加
            const newItems = trashIndex ? itemsWithChildren.slice(0, itemsWithChildren.indexOf(trashIndex)).concat(reIdItemsCopy).concat(itemsWithChildren.slice(itemsWithChildren.indexOf(trashIndex))) : itemsWithChildren.concat(reIdItemsCopy);


            if (newItems && trashIndex) {
              //移動先のDBにアイテムを追加
              set(treeItemsRef, newItems).catch((error) => {
                throw new Error('データベースにアイテムを保存できませんでした。' + error);
              });
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
      }).catch((error) => {
        throw new Error(error);
      });
    } catch (error) {
      console.error('エラーが発生しました。' + error);
      showDialog('エラーが発生しました。' + error, 'Error');
    }
  }


  // アイテムのテキスト値を変更する ------------------------------
  function handleValueChange(id: UniqueIdentifier, newValue: string) {
    const newItems = setProperty(items, id, 'value', () => newValue);
    setItems(newItems);
  }

  // アイテムのdone状態を変更する ------------------------------
  // 子孫のdone状態を更新する
  function updateChildrenDone(items: TreeItems, targetId: UniqueIdentifier, done: boolean): TreeItems {
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
  }
  // 本編
  function handleDoneChange(id: UniqueIdentifier, done: boolean) {
    // アイテム自体のdone状態を更新
    const updatedItems = setProperty(items, id, 'done', () => done);
    // 子要素のdone状態も更新
    const newItems = updateChildrenDone(updatedItems, id, done);
    setItems(newItems);
  }

  return { handleSelect, handleAddTask, handleRemove, handleValueChange, handleDoneChange, handleCopy, handleMove, handleRestore };
}