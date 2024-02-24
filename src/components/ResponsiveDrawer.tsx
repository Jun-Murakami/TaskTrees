import { useState } from 'react';
import { TreesList, TreesListItem } from '../types/types';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu';

const drawerWidth = 240;

interface DrawerProps {
  handleCreateNewTree: () => void;
  treesList: TreesList;
  currentTree: string | null;
  handleListClick: (treeId: string) => void;
}

export default function ResponsiveDrawer({ handleCreateNewTree, treesList, currentTree, handleListClick }: DrawerProps) {
  const [drawserState, setDrawerState] = useState(false);

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

  const drawerItems = (
    <div>
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
      <List>
        {treesList &&
          treesList.map((item: TreesListItem) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={currentTree === item.id}
                onClick={() => {
                  handleListClick(item.id);
                  setDrawerState(false);
                }}
              >
                <ListItemText secondary={item.name} />
              </ListItemButton>
            </ListItem>
          ))}
      </List>
    </div>
  );

  const theme = useTheme();

  return (
    <>
      <IconButton
        color='inherit'
        aria-label='open drawer'
        edge='start'
        onClick={toggleDrawer(true)}
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          display: { sm: 'none' },
          position: 'fixed',
          bottom: 17,
          right: 19,
          zIndex: 1000,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <MenuIcon />
      </IconButton>
      <Box sx={{ display: 'flex' }}>
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
