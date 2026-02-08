import { FC, useState } from 'react';
import { DraggableAttributes, DraggableSyntheticListeners, UniqueIdentifier } from '@dnd-kit/core';
import { ListItemText, ListItemButton, Button, IconButton, Menu, MenuItem, ListItemIcon, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DragHandle, Archive, MoreHoriz, DeleteForever, Unarchive } from '@mui/icons-material';
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
  onArchive?: (treeId: UniqueIdentifier, isArchived: boolean) => Promise<void>;
  onDelete?: (treeId: UniqueIdentifier) => Promise<void>;
};

export const SortableSource: FC<SortableSourceProps> = ({ item, handlerProps, handleListClick, setDrawerState, onArchive, onDelete }) => {
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleListItemButtonClick = async () => {
    await handleListClick(item.id);
    setDrawerState(false);
  };
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <ListItemButton
      selected={currentTree === item.id}
      onClick={async () => {
        await handleListItemButtonClick();
      }}
      sx={{
        opacity: 1,
        height: 37,
        minHeight: 37,
        py: 0,
        pr: 0.5,
        '& .more-button': {
          opacity: isMobile ? 0.6 : 0,
        },
        '&:hover .more-button': {
          opacity: 0.6,
        },
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
          touchAction: 'none',
          zIndex: 1500,
        }}
        {...handlerProps?.attributes}
        {...handlerProps?.listeners}
      >
        <DragHandle />
      </Button>
      <ListItemText secondary={item.name} sx={{ mr: 0.5 }} />
      {item.isArchived && <Archive sx={{ color: theme.palette.grey[500], fontSize: 18, flexShrink: 0, mr: 0.5 }} />}
      {(onArchive || onDelete) && (
        <>
          <IconButton
            className='more-button'
            size='small'
            onClick={handleMenuOpen}
            sx={{
              flexShrink: 0,
              width: 28,
              height: 28,
              color: theme.palette.text.secondary,
              transition: 'opacity 0.15s',
            }}
          >
            <MoreHoriz sx={{ fontSize: 18 }} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            onClick={(e) => e.stopPropagation()}
            slotProps={{ paper: { sx: { minWidth: 160 } } }}
          >
            {onArchive && (
              <MenuItem
                onClick={async () => {
                  handleMenuClose();
                  await onArchive(item.id, !item.isArchived);
                }}
              >
                <ListItemIcon>
                  {item.isArchived ? <Unarchive fontSize='small' /> : <Archive fontSize='small' />}
                </ListItemIcon>
                {item.isArchived ? '戻す' : 'アーカイブ'}
              </MenuItem>
            )}
            {onDelete && (
              <MenuItem
                onClick={async () => {
                  handleMenuClose();
                  await onDelete(item.id);
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <DeleteForever fontSize='small' color='error' />
                </ListItemIcon>
                削除
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </ListItemButton>
  );
};
