import { FC, useState } from 'react';
import { DndContext, DragOverlay, UniqueIdentifier, closestCenter, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { SortableSource } from './SortableSource';
import { SortableItem } from './SortableItem';
import { TreesList } from '../../types/types';

interface SortableListProps {
  treesList: TreesList;
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>;
  currentTree: UniqueIdentifier | null;
  handleListClick: (treeId: UniqueIdentifier) => void;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SortableList: FC<SortableListProps> = ({
  treesList,
  setTreesList,
  currentTree,
  handleListClick,
  setDrawerState,
}) => {
  const isPreviewMode = false;

  const [activeId, setActiveId] = useState<number | null>(null);

  const activeItem = treesList.find((item) => item.id === activeId?.toString());

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
          const oldIndex = treesList.findIndex((item) => item.id === active.id);
          const newIndex = treesList.findIndex((item) => item.id === over.id);
          const newItems = arrayMove(treesList, oldIndex, newIndex);
          setTreesList(newItems);
        }}
      >
        <SortableContext items={treesList}>
          {treesList.map((item) => (
            <SortableItem
              key={item.id}
              isPreviewMode={isPreviewMode}
              item={item}
              currentTree={currentTree}
              handleListClick={handleListClick}
              setDrawerState={setDrawerState}
            />
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
          {activeItem && (
            <SortableSource
              item={activeItem}
              currentTree={currentTree}
              handleListClick={handleListClick}
              setDrawerState={setDrawerState}
            />
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
};
