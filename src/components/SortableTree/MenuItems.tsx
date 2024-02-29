import { useState, MouseEvent } from 'react';
import { IconButton, Menu, MenuItem, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ListItemIcon from '@mui/material/ListItemIcon';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useTreeStateStore } from '../../store/treeStateStore';

interface MenuItemsProps {
  onRemove: () => void;
}

export function MenuItems({ onRemove }: MenuItemsProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const treesList = useTreeStateStore((state) => state.treesList);

  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleUploadClick = () => {};

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          top: 0,
          width: '30px',
          maxWidth: '30px',
          height: '30px',
          maxHeight: '30px',
          justifyContent: 'center',
          '& .MuiListItemIcon-root': {
            width: '30px',
            maxWidth: '30px',
            height: '30px',
            maxHeight: '30px',
          },
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id='menu'
        open={open}
        onClose={handleClose}
        sx={{
          elevation: 0,
        }}
      >
        <MenuItem
          onClick={() => {
            onRemove();
            handleClose();
          }}
        >
          <ListItemIcon>
            <DeleteForeverIcon fontSize='small' />
          </ListItemIcon>
          削除
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleUploadClick();
          }}
        >
          <ListItemIcon>
            <KeyboardDoubleArrowRightIcon fontSize='small' />
          </ListItemIcon>
          コピー
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
          }}
        >
          <ListItemIcon>
            <KeyboardArrowRightIcon fontSize='small' />
          </ListItemIcon>
          移動
        </MenuItem>
      </Menu>
    </>
  );
}
