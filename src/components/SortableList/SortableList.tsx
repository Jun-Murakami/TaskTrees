import { FC, useState } from 'react';
import { DndContext, DragOverlay, closestCenter, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { SortableSource } from './SortableSource';
import { SortableItem } from './SortableItem';

type Item = {
  id: number;
  text: string;
};

const ITEMS: Item[] = [
  { id: 1, text: '項目１' },
  { id: 2, text: '項目２' },
  { id: 3, text: '項目３' },
  { id: 4, text: '項目４' },
  { id: 5, text: '項目５' },
];

export const OverlaySortablePage: FC = () => {
  const isPreviewMode = false;

  const [activeId, setActiveId] = useState<number | null>(null);
  const [items, setItems] = useState(ITEMS);

  const activeItem = items.find((item) => item.id === activeId);

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={(event) => {
          setActiveId(event.active.id as number);
        }}
        onDragEnd={(event) => {
          setActiveId(null);
          const { active, over } = event;
          if (over == null || active.id === over.id) {
            return;
          }
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);
          const newItems = arrayMove(items, oldIndex, newIndex);
          setItems(newItems);
        }}
      >
        <SortableContext items={items}>
          {items.map((item) => (
            <SortableItem key={item.id} isPreviewMode={isPreviewMode} item={item} />
          ))}
        </SortableContext>
        <DragOverlay
          dropAnimation={
            isPreviewMode
              ? {
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: {},
                  }),
                }
              : undefined
          }
        >
          {activeItem && <SortableSource item={activeItem} />}
        </DragOverlay>
      </DndContext>
    </>
  );
};
