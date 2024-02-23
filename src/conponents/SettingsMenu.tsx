import React, { Dispatch, SetStateAction, useRef } from 'react';
import { styled } from '@mui/material/styles';
import { FormControlLabel, Switch, Menu, MenuItem, Box, Divider, Tooltip, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import ListItemIcon from '@mui/material/ListItemIcon';
import LogoutIcon from '@mui/icons-material/Logout';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

interface SettingsMenuProps {
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadAppState: () => void;
  handleLogout: () => void;
  setIsWaitingForDelete: Dispatch<SetStateAction<boolean>>;
}

export default function SettingsMenu({
  darkMode,
  setDarkMode,
  handleFileUpload,
  handleDownloadAppState,
  handleLogout,
  setIsWaitingForDelete,
}: SettingsMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
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

  const theme = useTheme();

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
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', textAlign: 'center' }}>
        <Button
          onClick={handleClick}
          variant='text'
          size='small'
          sx={{ ml: 2, color: theme.palette.text.secondary, margin: '0 auto' }}
          aria-controls={open ? 'account-menu' : undefined}
          aria-haspopup='true'
          aria-expanded={open ? 'true' : undefined}
          startIcon={<SettingsIcon sx={{ width: 32, height: 32 }} />}
        >
          <Typography sx={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Settings</Typography>
        </Button>
      </Box>
      <Menu
        anchorEl={anchorEl}
        id='account-menu'
        open={open}
        onClose={handleClose}
        sx={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
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
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Tooltip title='アプリからログアウト' placement='right'>
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize='small' />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Tooltip>
        <Divider />
        <Tooltip title='表示モードの切り替え' placement='right'>
          <MenuItem>
            <FormControlLabel
              control={<MaterialUISwitch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />}
              label={`${darkMode ? 'Dark Mode' : 'Light Mode'}`}
            />
          </MenuItem>
        </Tooltip>
        <Divider />
        <input type='file' ref={hiddenFileInput} onChange={handleFileUpload} style={{ display: 'none' }} accept='.json' />
        <Tooltip title='バックアップをアプリに復元' placement='right'>
          <MenuItem
            onClick={() => {
              handleUploadClick();
            }}
          >
            <ListItemIcon>
              <UploadIcon fontSize='small' />
            </ListItemIcon>
            Upload
          </MenuItem>
        </Tooltip>
        <Tooltip title='アプリのデータをバックアップ' placement='right'>
          <MenuItem
            onClick={() => {
              handleDownloadAppState();
              handleClose();
            }}
          >
            <ListItemIcon>
              <DownloadIcon fontSize='small' />
            </ListItemIcon>
            Backup
          </MenuItem>
        </Tooltip>
        <Divider />
        <Tooltip title='ユーザーアカウントの削除' placement='right'>
          <MenuItem
            onClick={() => {
              setIsWaitingForDelete(true);
              handleClose();
            }}
          >
            <ListItemIcon>
              <DeleteForeverIcon fontSize='small' />
            </ListItemIcon>
            Delete Account
          </MenuItem>
        </Tooltip>
      </Menu>
    </>
  );
}
