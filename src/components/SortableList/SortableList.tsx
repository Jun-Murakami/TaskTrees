import { FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, UniqueIdentifier, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTheme } from '@mui/material/styles';

import { SortableSource } from './SortableSource';
import { SortableItem } from './SortableItem';
import { TreesList } from '../../types/types';

interface SortableListProps {
  treesList: TreesList;
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>;
  currentTree: UniqueIdentifier | null;
  handleListClick: (treeId: UniqueIdentifier) => void;
  drawerState: boolean;
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

  const theme = useTheme();

  return (
    <>
      <DndContext
        collisionDetection={closestCenter} // ドラッグ中の要素の中心を検出
        modifiers={[restrictToVerticalAxis]} // 縦方向のみの移動に制限
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
        {createPortal(
          <DragOverlay
            style={{
              backgroundColor: theme.palette.action.focus,
            }}
            zIndex={1500}
          >
            {activeItem && (
              <SortableSource
                item={activeItem}
                currentTree={currentTree}
                handleListClick={handleListClick}
                setDrawerState={setDrawerState}
              />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </>
  );
};
