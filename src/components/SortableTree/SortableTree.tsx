import { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragOverlay, DropAnimation, Modifier, defaultDropAnimation, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  flattenTree,
  getProjection,
  getChildCount,
  removeItem,
  removeChildrenOf,
  setProperty,
  findItemDeep,
  findParentItem,
  isDescendantOfTrash,
} from './utilities';
import type { TreeItems } from '../../types/types';
import { SortableTreeItem } from './SortableTreeItem';
import { CSS } from '@dnd-kit/utilities';
import { useTreeStateStore } from '../../store/treeStateStore';
import { useDndStateStore } from '../../store/dndStateStore';

const dropAnimationConfig: DropAnimation = {
  keyframes({ transform }) {
    return [
      { opacity: 1, transform: CSS.Transform.toString(transform.initial) },
      {
        opacity: 0,
        transform: CSS.Transform.toString({
          ...transform.final,
          x: transform.final.x + 5,
          y: transform.final.y + 5,
        }),
      },
    ];
  },
  easing: 'ease-out',
  sideEffects({ active }) {
    active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: defaultDropAnimation.duration,
      easing: defaultDropAnimation.easing,
    });
  },
};

interface SortableTreeProps {
  collapsible?: boolean;
  defaultItems?: TreeItems;
  indentationWidth?: number;
  indicator?: boolean;
  removable?: boolean;
  hideDoneItems?: boolean;
  onSelect: (id: UniqueIdentifier) => void;
}

export function SortableTree({
  collapsible,
  indicator = false,
  indentationWidth = 30,
  removable,
  hideDoneItems = false,
  onSelect,
}: SortableTreeProps) {
  const activeId = useDndStateStore((state) => state.activeTreeId);
  const overId = useDndStateStore((state) => state.overTreeId);
  const offsetLeft = useDndStateStore((state) => state.offsetLeft);
  const projected = useDndStateStore((state) => state.projected);
  const setProjected = useDndStateStore((state) => state.setProjected);

  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);
    const collapsedItems = flattenedTree.reduce<string[]>(
      (acc, { children, collapsed, id }) => (collapsed && children.length ? [...acc, id.toString()] : acc),
      []
    );

    return removeChildrenOf(flattenedTree, activeId ? [activeId.toString(), ...collapsedItems] : collapsedItems);
  }, [activeId, items]);

  useEffect(() => {
    const newProjected = activeId && overId ? getProjection(flattenedItems, activeId, overId, offsetLeft, indentationWidth) : null;
    setProjected(newProjected);
  }, [activeId, overId, offsetLeft, indentationWidth, flattenedItems, setProjected]);


  const sortedIds = useMemo(() => flattenedItems.map(({ id }) => id), [flattenedItems]);
  const activeItem = activeId ? flattenedItems.find(({ id }) => id === activeId) : null;

  // タスクの値を更新
  function handleValueChange(id: UniqueIdentifier, newValue: string) {
    const newItems = setProperty(items, id, 'value', () => newValue);
    setItems(newItems);
  }

  // 子孫のdone状態を更新
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

  // タスクのdone状態を更新
  function handleDoneChange(id: UniqueIdentifier, done: boolean) {
    // アイテム自体のdone状態を更新
    const updatedItems = setProperty(items, id, 'done', () => done);
    // 子要素のdone状態も更新
    const newItems = updateChildrenDone(updatedItems, id, done);
    setItems(newItems);
  }

  // タスクの削除
  function handleRemove(id: UniqueIdentifier) {
    const currentItems = items;
    const itemToRemove = findItemDeep(currentItems, id);
    const trashItem = currentItems.find((item) => item.id === 'trash');

    if (itemToRemove && trashItem) {
      const itemToRemoveCopy = { ...itemToRemove, children: [...itemToRemove.children] }; // アイテムのコピーを作成

      // 親アイテムを見つけ、そのchildrenからアイテムを削除
      const parentItem = findParentItem(currentItems, id);
      if (isDescendantOfTrash(currentItems, id)) {
        return removeItem(currentItems, id);
      } else if (parentItem) {
        parentItem.children = parentItem.children.filter((child) => child.id !== id);
      }

      // アイテムをゴミ箱に移動
      trashItem.children = [...trashItem.children, itemToRemoveCopy]; // 不変性を保ちながら追加

      // 元のアイテムを削除した新しいアイテムリストを作成
      const newItems = parentItem ? currentItems : currentItems.filter((item) => item.id !== id);

      // ゴミ箱アイテムを更新
      const updatedItems = newItems.map((item) => (item.id === 'trash' ? { ...trashItem, children: trashItem.children } : item));

      setItems(updatedItems);
    }
  }

  return (
    <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
      {flattenedItems
        .filter(({ done }) => (hideDoneItems ? !done : true))
        .map(({ id, value, done, children, collapsed, depth }) => (
          <SortableTreeItem
            key={id}
            id={id.toString()}
            value={value.toString()}
            done={done}
            depth={id === activeId && projected ? projected.depth : depth}
            indentationWidth={indentationWidth}
            indicator={indicator}
            collapsed={Boolean(collapsed && children.length)}
            onCollapse={collapsible && children.length ? () => handleCollapse(id) : undefined}
            onRemove={removable ? () => handleRemove(id) : undefined}
            onChange={(newValue) => handleValueChange(id, newValue)}
            onChangeDone={(done) => handleDoneChange(id, done)}
            onSelect={onSelect}
          />
        ))}
      {activeId &&
        createPortal(
          <DragOverlay dropAnimation={dropAnimationConfig} modifiers={indicator ? [adjustTranslate] : undefined}>
            {activeId && activeItem ? (
              <SortableTreeItem
                id={activeId}
                depth={activeItem.depth}
                clone
                childCount={getChildCount(items, activeId) + 1}
                value={activeItem.value.toString()}
                indentationWidth={indentationWidth}
                done={activeItem.done}
                onSelect={onSelect}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </SortableContext>
  );

  function handleCollapse(id: UniqueIdentifier) {
    const newItems = setProperty(items, id, 'collapsed', (value) => {
      return !value;
    });
    setItems(newItems);
  }
}

const adjustTranslate: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: transform.y - 25,
  };
};
