import { useEffect, useState } from 'react';
import { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent, Modifiers } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { buildTree, flattenTree } from '../components/SortableTree/utilities';
import type { FlattenedItem } from '../types/types';
import { useDndStateStore } from '../store/dndStateStore';
import { useTreeStateStore } from '../store/treeStateStore';

export const useDndContext = () => {
  const [modifiers, setModifiers] = useState<Modifiers | undefined>(undefined);

  const setActiveTreeId = useDndStateStore((state) => state.setActiveTreeId);
  const activeListId = useDndStateStore((state) => state.activeListId);
  const setActiveListId = useDndStateStore((state) => state.setActiveListId);
  const setOverTreeId = useDndStateStore((state) => state.setOverTreeId);
  const setOverListId = useDndStateStore((state) => state.setOverListId);

  const setOffsetLeft = useDndStateStore((state) => state.setOffsetLeft);
  const projected = useDndStateStore((state) => state.projected);
  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
    const isItemFromTreeList = treesList.some((item) => item.id === activeId);

    if (!isItemFromTreeList) {
      setActiveListId(null);
      setOverListId(null);
      setActiveTreeId(activeId);
      setOverTreeId(activeId);
    } else {
      setActiveTreeId(null);
      setOverTreeId(null);
      setActiveListId(activeId);
      setOverListId(activeId);
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
      setOverListId(null);
      setOverTreeId(over.id);
    } else {
      setOverTreeId(null);
      setOverListId(over.id);
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
    setOverListId(null);
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

  return { handleDragStart, handleDragMove, handleDragOver, handleDragEnd, handleDragCancel, modifiers };
};
