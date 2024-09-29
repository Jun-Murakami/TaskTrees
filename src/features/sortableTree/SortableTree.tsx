import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy,
  DropAnimation,
  Modifier,
  defaultDropAnimation,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  buildTree,
  flattenTree,
  getProjection,
  getChildCount,
  removeChildrenOf,
  setProperty,
  findMaxId,
  isDescendantOfTrash,
} from '@/features/sortableTree/utilities';
import type { FlattenedItem, SensorContext, TreeItems } from '@/types/types';
import { sortableTreeKeyboardCoordinates } from '@/features/sortableTree/keyboardCoordinates';
import { SortableTreeItem } from '@/features/sortableTree/SortableTreeItem';
import { AddTask } from '@/features/sortableTree/AddTask';
import { ImportQuickMemo } from '@/features/sortableTree/ImportQuickMemo';
import { CSS } from '@dnd-kit/utilities';
import { useTheme, useMediaQuery } from '@mui/material';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useAppStateStore } from '@/store/appStateStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';

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
}

export function SortableTree({ collapsible, indicator = false, indentationWidth = 30, removable }: SortableTreeProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeNewTaskId, setActiveNewTaskId] = useState<UniqueIdentifier>('-1');
  const [activeQuickMemoId, setActiveQuickMemoId] = useState<UniqueIdentifier>('-10000');
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [importButtonSpacer, setImportButtonSpacer] = useState(176);
  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const searchKey = useAppStateStore((state) => state.searchKey);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems);
  const isEditingText = useAppStateStore((state) => state.isEditingText);
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded);
  const setIsQuickMemoExpanded = useAppStateStore((state) => state.setIsQuickMemoExpanded);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);

  // タスクを管理するカスタムフック
  const {
    handleRemove,
    handleValueChange,
    handleDoneChange,
    handleCopy,
    handleMove,
    handleRestore,
    handleAttachFile,
    removeTrashDescendants,
    removeTrashDescendantsWithDone,
  } = useTaskManagement();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isMobile) {
    indentationWidth = 22;
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerHeight < 600 || isMobile) {
        setImportButtonSpacer(176);
      } else {
        setImportButtonSpacer(367);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
    draggable: {
      measure: (node: HTMLElement | null) => {
        if (activeId === activeNewTaskId || activeId === activeQuickMemoId) {
          const rect = node!.getBoundingClientRect();
          if (isMobile && activeId === activeNewTaskId) {
            rect.y = window.innerHeight - 50;
          } else if (activeId === activeQuickMemoId) {
            rect.y = window.innerHeight - importButtonSpacer;
          } else {
            rect.y += window.scrollY - 30;
          }
          return rect;
        }
        // それ以外の要素には通常の処理を適用
        return node!.getBoundingClientRect();
      },
    },
  };

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);
    let collapsedItems = flattenedTree.reduce<string[]>(
      (acc, { children, collapsed, id }) => (collapsed && children.length ? [...acc, id.toString()] : acc),
      []
    );
    // searchKeyが設定されていた場合、collapsedItemsを空の配列にする
    if (searchKey !== '') {
      collapsedItems = [];
    }
    return removeChildrenOf(flattenedTree, activeId ? [activeId.toString(), ...collapsedItems] : collapsedItems);
  }, [activeId, items, searchKey]);

  const projected = activeId && overId ? getProjection(flattenedItems, activeId, overId, offsetLeft, indentationWidth) : null;
  const sensorContext: SensorContext = useRef({
    items: flattenedItems,
    offset: offsetLeft,
  });
  const [coordinateGetter] = useState(() => sortableTreeKeyboardCoordinates(sensorContext, indicator, indentationWidth));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter,
    })
  );

  const sortedIds = useMemo(() => flattenedItems.map(({ id }) => id), [flattenedItems]);
  const activeItem = activeId ? flattenedItems.find(({ id }) => id === activeId) : null;

  useEffect(() => {
    sensorContext.current = {
      items: flattenedItems,
      offset: offsetLeft,
    };
  }, [flattenedItems, offsetLeft]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {currentTree && !(isEditingText && isMobile) && <AddTask id={activeNewTaskId} />}
      {isQuickMemoExpanded && !(isEditingText && isMobile) && quickMemoText !== '' && <ImportQuickMemo id={activeQuickMemoId} />}
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {flattenedItems
          .filter(({ done }) => (hideDoneItems ? !done : true))
          .filter(({ value }) => value.toLowerCase().includes(searchKey.toLowerCase()))
          //.filter((item) => (searchKey !== '' ? !isDescendantOfTrash(items, item.id) : true)) // ゴミ箱の中は検索しない
          .map(({ id, value, done, attachedFile, timer, isUpLift, upLiftMinute, children, collapsed, depth }) => (
            <SortableTreeItem
              key={id}
              id={id.toString()}
              value={value}
              done={done}
              attachedFile={attachedFile}
              timer={timer}
              isUpLift={isUpLift}
              upLiftMinute={upLiftMinute}
              depth={id === activeId && projected ? projected.depth : depth}
              indentationWidth={indentationWidth}
              indicator={indicator}
              collapsed={Boolean(collapsed && children.length)}
              onCollapse={collapsible && children.length ? () => handleCollapse(id) : undefined}
              onRemove={removable ? () => (handleRemove ? handleRemove(id) : undefined) : undefined}
              onChange={(newValue) => handleValueChange(id, newValue)}
              onChangeDone={(done) => handleDoneChange(id, done)}
              onCopyItems={handleCopy}
              onMoveItems={handleMove}
              onRestoreItems={handleRestore}
              handleAttachFile={handleAttachFile}
              removeTrashDescendants={removeTrashDescendants}
              removeTrashDescendantsWithDone={removeTrashDescendantsWithDone}
              isItemDescendantOfTrash={isDescendantOfTrash(items, id)}
            />
          ))}
        {createPortal(
          <DragOverlay dropAnimation={dropAnimationConfig} modifiers={indicator ? [adjustTranslate] : undefined}>
            {activeId && activeItem ? (
              <SortableTreeItem
                id={activeId}
                depth={activeItem.depth}
                clone
                childCount={getChildCount(items, activeId) + 1}
                value={activeItem.value.toString()}
                indentationWidth={indentationWidth}
                handleAttachFile={handleAttachFile}
                done={activeItem.done}
                isNewTask={activeId === activeNewTaskId || activeId === activeQuickMemoId}
                isItemDescendantOfTrash={isDescendantOfTrash(items, activeId)}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </SortableContext>
    </DndContext>
  );

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
    if (isLoading) return;
    if (activeId === activeNewTaskId || activeId === activeQuickMemoId) {
      const activeNewTaskItem = {
        id: activeId,
        value: activeId === activeNewTaskId ? '新しいタスク' : quickMemoText,
        done: false,
        parentId: null,
        depth: 0,
        children: [],
      };
      setItems([activeNewTaskItem, ...items]);
    }

    setActiveId(activeId);
    setOverId(activeId);

    document.body.style.setProperty('cursor', 'grabbing');
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();
    if (projected && over) {
      const { depth, parentId } = projected;
      const clonedItems: FlattenedItem[] = JSON.parse(JSON.stringify(flattenTree(items)));
      const trashIndex = clonedItems.findIndex(({ id }) => id === 'trash'); // ゴミ箱の位置を検索

      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      // over.idがゴミ箱より後ろにあり、かつdepthが0の場合、depthを1に更新
      let putDepth;
      let putParentId;
      if (overIndex >= trashIndex && depth === 0) {
        putDepth = 1;
        putParentId = 'trash';
      } else {
        putDepth = depth;
        putParentId = parentId;
      }

      clonedItems[activeIndex] = { ...activeTreeItem, depth: putDepth, parentId: putParentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      if (active.id === activeNewTaskId || active.id === activeQuickMemoId) {
        // newItemsをchildren内も再帰的に検索し-1のIDを持つ新規タスクのIDを最大ID+1に変更
        const updateItemIdRecursively = (items: TreeItems, targetId: UniqueIdentifier, newId: UniqueIdentifier): TreeItems => {
          return items.map((item) => {
            // IDが目的のIDと一致する場合、新しいIDで更新
            if (item.id === targetId) {
              return {
                ...item,
                id: newId,
                value: active.id === activeNewTaskId ? '' : quickMemoText,
                children: updateItemIdRecursively(item.children, targetId, newId),
              };
            }
            // 子アイテムも同様に処理
            return { ...item, children: updateItemIdRecursively(item.children, targetId, newId) };
          });
        };
        const newItemsWithId = updateItemIdRecursively(newItems, active.id, (findMaxId(newItems) + 1).toString());
        setItems(newItemsWithId);
        const newActiveId = (parseInt(active.id.toString()) - 1).toString();
        if (active.id === activeNewTaskId) {
          setActiveNewTaskId(newActiveId);
        } else {
          setActiveQuickMemoId(newActiveId);
          setIsQuickMemoExpanded(false);
          setQuickMemoText('');
        }
      } else {
        setItems(newItems);
      }
    } else {
      // 新規タスクの場合、新規タスクを先頭に移動し、IDを最大ID+1に更新
      if (active.id === activeNewTaskId || active.id === activeQuickMemoId) {
        const newId = (findMaxId(items) + 1).toString();
        const updatedItems = items.map((item) => (item.id === active.id ? { ...item, id: newId, value: '' } : item));
        setItems([updatedItems.find((item) => item.id === newId)!, ...items.filter((item) => item.id !== active.id)]);
        const newActiveId = (parseInt(active.id.toString()) - 1).toString();
        if (active.id === activeNewTaskId) {
          setActiveNewTaskId(newActiveId);
        } else {
          setActiveQuickMemoId(newActiveId);
        }
      }
    }
  }

  function handleDragCancel() {
    resetState();
    // 新規タスクの場合、新規タスクを先頭に移動し、IDを最大ID+1に更新
    if (activeId === activeNewTaskId || activeId === activeQuickMemoId) {
      const newId = (findMaxId(items) + 1).toString();
      const updatedItems = items.map((item) => (item.id === activeId ? { ...item, id: newId, value: '' } : item));
      setItems([updatedItems.find((item) => item.id === newId)!, ...items.filter((item) => item.id !== activeId)]);
      const newActiveId = (parseInt(activeId.toString()) - 1).toString();
      if (activeId === activeNewTaskId) {
        setActiveNewTaskId(newActiveId);
      } else {
        setActiveQuickMemoId(newActiveId);
      }
    }
  }

  function resetState() {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);

    document.body.style.setProperty('cursor', '');
  }

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
