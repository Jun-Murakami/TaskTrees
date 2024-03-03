import { FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, UniqueIdentifier, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTheme } from '@mui/material/styles';
import { useTreeStateStore } from '../../store/treeStateStore';
import { useDatabase } from '../../hooks/useDatabase';
import { SortableSource } from './SortableSource';
import { SortableItem } from './SortableItem';

interface SortableListProps {
  handleListClick: (treeId: UniqueIdentifier) => void;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SortableList: FC<SortableListProps> = ({ handleListClick, setDrawerState }) => {
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);

  const [activeId, setActiveId] = useState<number | null>(null);

  const { saveTreesListDb } = useDatabase();

  const isPreviewMode = false;
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
          saveTreesListDb(newItems);
        }}
      >
        <SortableContext items={treesList}>
          {treesList.map((item) => (
            <SortableItem
              key={item.id}
              isPreviewMode={isPreviewMode}
              item={item}
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
            {activeItem && <SortableSource item={activeItem} handleListClick={handleListClick} setDrawerState={setDrawerState} />}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </>
  );
};
