import { FC } from 'react';
import { DraggableAttributes, DraggableSyntheticListeners, UniqueIdentifier } from '@dnd-kit/core';
import { ListItemText, ListItemButton, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import { TreesListItem } from '../../types/types';

export type SortableSourceProps = {
  item: TreesListItem;
  handlerProps?: {
    ref: (element: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
  currentTree: UniqueIdentifier | null;
  handleListClick: (treeId: UniqueIdentifier) => void;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SortableSource: FC<SortableSourceProps> = ({ item, handlerProps, currentTree, handleListClick, setDrawerState }) => {
  const theme = useTheme();
  return (
    <ListItemButton
      selected={currentTree === item.id}
      onClick={() => {
        handleListClick(item.id);
        setDrawerState(false);
      }}
    >
      <Button
        ref={handlerProps?.ref}
        sx={{
          cursor: handlerProps ? 'grab' : 'grabbing',
          color: theme.palette.grey[500],
          width: '20px',
          minWidth: '20px',
          height: '20px',
          mr: '10px',
        }}
        {...handlerProps?.attributes}
        {...handlerProps?.listeners}
      >
        <DragHandleIcon />
      </Button>
      <ListItemText secondary={item.name} />
    </ListItemButton>
  );
};
