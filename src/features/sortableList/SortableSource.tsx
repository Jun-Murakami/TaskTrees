import { FC } from 'react';
import { DraggableAttributes, DraggableSyntheticListeners, UniqueIdentifier } from '@dnd-kit/core';
import { ListItemText, ListItemButton, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import { TreesListItem } from '@/types/types';
import { useTreeStateStore } from '@/store/treeStateStore';

export type SortableSourceProps = {
  item: TreesListItem;
  handlerProps?: {
    ref: (element: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
  handleListClick: (treeId: UniqueIdentifier) => Promise<void>;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SortableSource: FC<SortableSourceProps> = ({ item, handlerProps, handleListClick, setDrawerState }) => {
  const currentTree = useTreeStateStore((state) => state.currentTree);

  const handleListItemButtonClick = async () => {
    await handleListClick(item.id);
    setDrawerState(false);
  };
  const theme = useTheme();

  return (
    <ListItemButton
      selected={currentTree === item.id}
      onClick={async () => {
        await handleListItemButtonClick();
      }}
      sx={{ opacity: 1, height: 50 }}
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
          touchAction: 'none',
          zIndex: 1500,
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
