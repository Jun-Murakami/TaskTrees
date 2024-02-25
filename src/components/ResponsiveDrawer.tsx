import { Dispatch, useState, SetStateAction } from 'react';
import { TreesList } from '../types/types';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SwipeableDrawer,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import { UniqueIdentifier } from '@dnd-kit/core';
import { SortableList } from './SortableList/SortableList';
import { SettingsMenu } from './SettingsMenu';
import { Typography } from '@mui/material';

const drawerWidth = 240;

interface ResponsiveDrawerProps {
  handleCreateNewTree: () => void;
  treesList: TreesList;
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>;
  hideDoneItems: boolean;
  setHideDoneItems: Dispatch<SetStateAction<boolean>>;
  currentTree: UniqueIdentifier | null;
  handleListClick: (treeId: UniqueIdentifier) => void;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadAppState: () => void;
  handleLogout: () => void;
  setIsWaitingForDelete: Dispatch<SetStateAction<boolean>>;
}

export function ResponsiveDrawer({
  handleCreateNewTree,
  treesList,
  setTreesList,
  hideDoneItems,
  setHideDoneItems,
  currentTree,
  handleListClick,
  darkMode,
  setDarkMode,
  handleFileUpload,
  handleDownloadAppState,
  handleLogout,
  setIsWaitingForDelete,
}: ResponsiveDrawerProps) {
  const [drawserState, setDrawerState] = useState(false);

  const theme = useTheme();

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event &&
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' || (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }

    setDrawerState(open);
  };

  // 完了したアイテムを非表示にする
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHideDoneItems(event.target.checked);
  };

  const drawerItems = (
    <>
      <List>
        <ListItem disablePadding>
          <ListItemButton
            sx={{
              '& .MuiListItemIcon-root': {
                minWidth: 0,
                marginRight: 1,
              },
            }}
            onClick={() => {
              handleCreateNewTree();
              setDrawerState(false);
            }}
          >
            <ListItemIcon>
              <AddIcon />
            </ListItemIcon>
            <ListItemText secondary='新しいツリーを作成' />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List sx={{ height: '100%' }}>
        {treesList && (
          <SortableList
            treesList={treesList}
            setTreesList={setTreesList}
            currentTree={currentTree}
            handleListClick={handleListClick}
            setDrawerState={setDrawerState}
          />
        )}
      </List>
      <Divider sx={{ bottom: 0 }} />
      <List sx={{ bottom: 0 }}>
        <ListItem disablePadding sx={{ pl: 2 }}>
          <FormControlLabel
            control={<Switch checked={hideDoneItems} onChange={handleSwitchChange} />}
            label={
              <Typography sx={{ fontSize: '0.9em', whiteSpace: 'nowrap', color: theme.palette.text.secondary }}>
                完了タスクを非表示
              </Typography>
            }
          />
        </ListItem>
      </List>
      <Divider sx={{ bottom: 0 }} />
      <List sx={{ bottom: 0 }}>
        <SettingsMenu
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          handleFileUpload={handleFileUpload}
          handleDownloadAppState={handleDownloadAppState}
          handleLogout={handleLogout}
          setIsWaitingForDelete={setIsWaitingForDelete}
          currentTree={currentTree}
        />
      </List>
    </>
  );

  return (
    <>
      {!currentTree && treesList.length === 0 && (
        <Typography
          variant='caption'
          sx={{
            display: { sm: 'none' },
            position: 'fixed',
            bottom: 30,
            right: 100,
            zIndex: 1000,
          }}
        >
          Tap to open the tree list →
        </Typography>
      )}
      <IconButton
        color='inherit'
        aria-label='open drawer'
        edge='start'
        onClick={toggleDrawer(true)}
        size='large'
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          display: { sm: 'none' },
          position: 'fixed',
          bottom: 15,
          right: 30,
          zIndex: 1000,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <MenuIcon />
      </IconButton>
      <Box sx={{ display: 'flex', height: '100%' }}>
        <Box component='nav' sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }} aria-label='mailbox folders'>
          {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
          <SwipeableDrawer
            anchor='right'
            variant='temporary'
            open={drawserState}
            onOpen={toggleDrawer(true)}
            onClose={toggleDrawer(false)}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawerItems}
          </SwipeableDrawer>
          <Drawer
            variant='permanent'
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
            open
          >
            {drawerItems}
          </Drawer>
        </Box>
      </Box>
    </>
  );
}
