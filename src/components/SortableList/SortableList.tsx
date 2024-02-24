import { FC, useState } from 'react';
import { DndContext, DragOverlay, closestCenter, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { SortableSource } from './SortableSource';
import { SortableItem } from './SortableItem';

import { TreesList } from '../../types/types';

export const OverlaySortablePage: FC = () => {
  const isPreviewMode = false;

  const [activeId, setActiveId] = useState<number | null>(null);
  const [items, setItems] = useState<TreesList>(null);

  const activeItem = items?.find((item) => item.id === String(activeId));

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
          const oldIndex = items?.findIndex((item) => item.id === active.id);
          const newIndex = items?.findIndex((item) => item.id === over.id);
          if (items && oldIndex !== undefined && newIndex !== undefined) {
            const newItems = arrayMove(items, oldIndex, newIndex);
            setItems(newItems);
          }
        }}
      >
        {items && (
          <SortableContext items={items}>
            {items.map((item) => (
              <SortableItem key={item.id} isPreviewMode={isPreviewMode} item={item} />
            ))}
          </SortableContext>
        )}
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
