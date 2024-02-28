import { useEffect, useState } from 'react';
import { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent, Modifiers, UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { buildTree, flattenTree } from '../components/SortableTree/utilities';
import type { FlattenedItem, Projected, TreeItem, TreesList } from '../types/types';

export const useDndContext = () => {
  const [modifiers, setModifiers] = useState<Modifiers | undefined>(undefined);

  const [activeListId, setActiveListId] = useState<UniqueIdentifier | null>(null);
  const [activeTreeId, setActiveTreeId] = useState<UniqueIdentifier | null>(null);
  const [overTreeId, setOverTreeId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState<number>(0);
  const [projected, setProjected] = useState<Projected>(null);

  const [items, setItems] = useState<TreeItem[]>([]);
  const [treesList, setTreesList] = useState<TreesList>([]);

  // パフォーマンスを比較するためにコメントアウト
  // const items = useTreeStateStore((state) => state.items);
  // const setItems = useTreeStateStore((state) => state.setItems);
  // const treesList = useTreeStateStore((state) => state.treesList);
  // const setTreesList = useTreeStateStore((state) => state.setTreesList);

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
    const isItemFromTreeList = treesList.some((item) => item.id === activeId);

    if (!isItemFromTreeList) {
      setActiveListId(null);
      setActiveTreeId(activeId);
      setOverTreeId(activeId);
    } else {
      setActiveTreeId(null);
      setOverTreeId(null);
      setActiveListId(activeId);
    }

    document.body.style.setProperty('cursor', 'grabbing');
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    if (!over) {
      return;
    }
    const isItemFromTreeList = treesList.some((item) => item.id === over.id);

    if (!isItemFromTreeList) {
      setOverTreeId(over.id);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();
    if (!active || !over) {
      return;
    }
    const isItemFromTreeList = treesList.some((item) => item.id === over.id);
    if (projected && !isItemFromTreeList) {
      const { depth, parentId } = projected;
      const clonedItems: FlattenedItem[] = JSON.parse(JSON.stringify(flattenTree(items)));
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      setItems(newItems);
    } else if (isItemFromTreeList) {
      const oldIndex = treesList.findIndex((item) => item.id === active.id);
      const newIndex = treesList.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(treesList, oldIndex, newIndex);
      setTreesList(newItems);
    }
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setOverTreeId(null);
    setActiveTreeId(null);
    setActiveListId(null);
    setOffsetLeft(0);

    document.body.style.setProperty('cursor', '');
  }

  useEffect(() => {
    if (activeListId) {
      setModifiers([restrictToVerticalAxis]);
    } else {
      setModifiers(undefined);
    }
  }, [activeListId]);

  return { handleDragStart, handleDragMove, handleDragOver, handleDragEnd, handleDragCancel, modifiers, activeListId, activeTreeId, overTreeId, offsetLeft, projected, setProjected };
};
