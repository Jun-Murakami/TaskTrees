import { FC } from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { Box } from '@mui/material';
import { CSS } from '@dnd-kit/utilities';
import { UniqueIdentifier } from '@dnd-kit/core';
import { SortableSource } from './SortableSource';
import { TreesListItem } from '../../types/types';

export type SortableItemProps = {
  isPreviewMode: boolean;
  item: TreesListItem;
  handleListClick: (treeId: UniqueIdentifier) => void;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SortableItem: FC<SortableItemProps> = ({ isPreviewMode, item, handleListClick, setDrawerState }) => {
  const { isDragging, isSorting, setNodeRef, transform, transition, setActivatorNodeRef, attributes, listeners } = useSortable({
    id: item.id,
    animateLayoutChanges: isPreviewMode ? ({ isSorting }) => !isSorting : defaultAnimateLayoutChanges,
  });

  const canTransform = !isPreviewMode || !isSorting;

  const opacity = isPreviewMode ? 0.5 : 0;

  const itemStyle = {
    position: 'relative',
    ...(isDragging ? { opacity } : {}), // opacity が undefined の場合はプロパティ自体を追加しない
    ...(canTransform && transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
    height: 50,
  };

  return (
    <Box ref={setNodeRef} sx={itemStyle}>
      <SortableSource
        item={item}
        handlerProps={{
          ref: setActivatorNodeRef,
          attributes,
          listeners,
        }}
        handleListClick={handleListClick}
        setDrawerState={setDrawerState}
      />
    </Box>
  );
};
