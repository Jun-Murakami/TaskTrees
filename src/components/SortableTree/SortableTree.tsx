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
  removeItem,
  removeChildrenOf,
  setProperty,
  findItemDeep,
  findParentItem,
  isDescendantOfTrash,
} from './utilities';
import type { FlattenedItem, SensorContext, TreeItems } from '../../types/types';
import { sortableTreeKeyboardCoordinates } from './keyboardCoordinates';
import { SortableTreeItem } from './SortableTreeItem';
import { CSS } from '@dnd-kit/utilities';
import { useTreeStateStore } from '../../store/treeStateStore';

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

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
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

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

  function handleValueChange(id: UniqueIdentifier, newValue: string) {
    const newItems = setProperty(items, id, 'value', () => newValue);
    setItems(newItems);
  }

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

  function handleDoneChange(id: UniqueIdentifier, done: boolean) {
    // アイテム自体のdone状態を更新
    const updatedItems = setProperty(items, id, 'done', () => done);
    // 子要素のdone状態も更新
    const newItems = updateChildrenDone(updatedItems, id, done);
    setItems(newItems);
  }

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
                done={activeItem.done}
                onSelect={onSelect}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </SortableContext>
    </DndContext>
  );

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
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
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      setItems(newItems);
    }
  }

  function handleDragCancel() {
    resetState();
  }

  function resetState() {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);

    document.body.style.setProperty('cursor', '');
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
