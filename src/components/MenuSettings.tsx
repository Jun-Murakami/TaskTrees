import React, { useRef } from 'react';
import { styled } from '@mui/material/styles';
import {
  FormControlLabel,
  Switch,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';
import LogoutIcon from '@mui/icons-material/Logout';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';

interface MenuSettingsProps {
  handleFileUpload: (file: File) => void;
  handleDownloadAppState: () => Promise<void>;
  handleDownloadAllTrees: (isSilent?: boolean) => Promise<string>;
  handleLogout: () => void;
}

export function MenuSettings({
  handleFileUpload,
  handleDownloadAppState,
  handleDownloadAllTrees,
  handleLogout,
}: MenuSettingsProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const darkMode = useAppStateStore((state) => state.darkMode);
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const setIsWaitingForDelete = useAppStateStore((state) => state.setIsWaitingForDelete);
  const currentTree = useTreeStateStore((state) => state.currentTree);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const hiddenFileInput = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    hiddenFileInput.current?.click();
  };

  const MaterialUISwitch = styled(Switch)(({ theme }) => ({
    width: 62,
    height: 34,
    padding: 7,
    '& .MuiSwitch-switchBase': {
      margin: 1,
      padding: 0,
      transform: 'translateX(6px)',
      '&.Mui-checked': {
        color: '#fff',
        transform: 'translateX(22px)',
        '& .MuiSwitch-thumb:before': {
          backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
            '#fff'
          )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`,
        },
        '& + .MuiSwitch-track': {
          opacity: 1,
          backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : theme.palette.primary.light,
        },
      },
    },
    '& .MuiSwitch-thumb': {
      backgroundColor: theme.palette.mode === 'light' ? theme.palette.background.default : theme.palette.primary.main,
      width: 32,
      height: 32,
      '&::before': {
        content: "''",
        position: 'absolute',
        width: '100%',
        height: '100%',
        left: 0,
        top: 0,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.primary.main
        )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`,
      },
    },
    '& .MuiSwitch-track': {
      opacity: 1,
      backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
      borderRadius: 20 / 2,
    },
  }));

  return (
    <ListItem disablePadding>
      <ListItemButton
        onClick={handleClick}
        sx={{
          '& .MuiListItemIcon-root': {
            minWidth: 0,
            marginRight: 1,
          },
        }}
      >
        <ListItemIcon>
          <SettingsIcon />
        </ListItemIcon>
        <ListItemText secondary='設定' />
      </ListItemButton>
      <Menu
        anchorEl={anchorEl}
        id='account-menu'
        open={open}
        onClose={handleClose}
        sx={{
          elevation: 0,
          overflow: 'visible',
          '& .MuiPaper-root': {
            width: 300,
            minWidth: 300,
            left: { xs: 'auto !important', sm: 0 },
            right: { xs: 0, sm: 'auto !important' },
          },
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            ml: -0.5,
            mr: 1,
          },
          '&::before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 14,
            width: 10,
            height: 10,
            bgcolor: 'background.paper',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Tooltip title='アプリケーションの全データとアカウントの削除' placement='right'>
          <MenuItem
            onClick={() => {
              setIsWaitingForDelete(true);
              handleClose();
            }}
          >
            <ListItemIcon>
              <DeleteForeverIcon fontSize='small' />
            </ListItemIcon>
            アカウント削除
          </MenuItem>
        </Tooltip>
        <Divider />
        <input
          type='file'
          ref={hiddenFileInput}
          onChange={(event) => {
            handleFileUpload(event.target.files![0]);
            handleClose();
          }}
          style={{ display: 'none' }}
          accept='.json'
        />
        <Tooltip title='バックアップしたデータを復元' placement='right'>
          <MenuItem
            onClick={() => {
              handleUploadClick();
            }}
          >
            <ListItemIcon>
              <UploadIcon fontSize='small' />
            </ListItemIcon>
            Import Tree(s)
          </MenuItem>
        </Tooltip>
        {currentTree && (
          <Tooltip title='現在のツリーのデータをバックアップ' placement='right'>
            <MenuItem
              onClick={async () => {
                await handleDownloadAppState();
                handleClose();
              }}
            >
              <ListItemIcon>
                <DownloadIcon fontSize='small' />
              </ListItemIcon>
              Backup Tree
            </MenuItem>
          </Tooltip>
        )}
        <Tooltip title='すべてのツリーデータをバックアップ' placement='right'>
          <MenuItem
            onClick={async () => {
              await handleDownloadAllTrees();
              handleClose();
            }}
          >
            <ListItemIcon>
              <DownloadIcon fontSize='small' />
            </ListItemIcon>
            Backup All Trees
          </MenuItem>
        </Tooltip>
        <Divider />
        <Tooltip title='表示モードの切り替え' placement='right'>
          <MenuItem>
            <FormControlLabel
              control={
                <MaterialUISwitch
                  checked={darkMode}
                  onChange={() => {
                    setDarkMode(!darkMode);
                  }}
                />
              }
              label={`${darkMode ? 'Dark Mode' : 'Light Mode'}`}
              sx={{ width: '100%' }}
            />
          </MenuItem>
        </Tooltip>
        <Divider />
        <Tooltip title='アプリからログアウト' placement='right'>
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize='small' />
            </ListItemIcon>
            ログアウト
          </MenuItem>
        </Tooltip>
      </Menu>
    </ListItem>
  );
}
