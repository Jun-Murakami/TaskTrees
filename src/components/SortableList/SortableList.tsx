import { FC } from 'react';
import { createPortal } from 'react-dom';
import { DragOverlay, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { useTheme } from '@mui/material/styles';
import type { TreesList } from '../../types/types';

import { SortableSource } from './SortableSource';
import { SortableItem } from './SortableItem';

interface SortableListProps {
  handleListClick: (treeId: UniqueIdentifier) => void;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
  activeId: UniqueIdentifier | null;
  treesList: TreesList;
}

export const SortableList: FC<SortableListProps> = ({ handleListClick, setDrawerState, activeId, treesList }) => {
  const isPreviewMode = false;
  const activeItem = treesList.find((item) => item.id === activeId?.toString());

  const theme = useTheme();

  return (
    <>
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
      {activeId &&
        createPortal(
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
    </>
  );
};
