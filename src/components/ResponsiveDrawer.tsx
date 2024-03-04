import { useState, useEffect } from 'react';
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
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { SortableList } from './SortableList/SortableList';
import { MenuSettings } from './MenuSettings';

const drawerWidth = 240;

interface ResponsiveDrawerProps {
  handleCreateNewTree: () => void;
  handleListClick: (treeId: UniqueIdentifier) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadAppState: () => void;
  handleLogout: () => void;
}

export function ResponsiveDrawer({
  handleCreateNewTree,
  handleListClick,
  handleFileUpload,
  handleDownloadAppState,
  handleLogout,
}: ResponsiveDrawerProps) {
  const [drawerState, setDrawerState] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isSwipe, setIsSwipe] = useState(false);
  const [startTouch, setStartTouch] = useState<Touch | null>(null);

  const darkMode = useAppStateStore((state) => state.darkMode);
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);

  const currentTree = useTreeStateStore((state) => state.currentTree);
  const treesList = useTreeStateStore((state) => state.treesList);

  useEffect(() => {
    if (drawerState) {
      const setTimer = setTimeout(() => {
        setIsMenuVisible(true);
      }, 170);
      return () => clearTimeout(setTimer);
    } else {
      setIsMenuVisible(false);
    }
  }, [drawerState]);

  useEffect(() => {
    if (isSwipe && drawerState) {
      setIsMenuVisible(false);
    } else if (!isSwipe && drawerState) {
      const setTimer = setTimeout(() => {
        // drawerStateがfalseになっているかチェック
        if (!drawerState) {
          return;
        }
        setIsMenuVisible(true);
      }, 170);
      return () => clearTimeout(setTimer);
    } else {
      setIsMenuVisible(false);
    }
  }, [isSwipe, drawerState]);

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
      <List sx={{ height: '100%' }}>
        {treesList && <SortableList handleListClick={handleListClick} setDrawerState={setDrawerState} />}
      </List>
      <Box sx={{ display: { xs: 'block', sm: 'none' }, height: '175px', minHeight: '175px' }} />
    </>
  );

  const handleTouchStart = (event: React.TouchEvent) => {
    setStartTouch(event.touches[0] as Touch | null);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const endTouch = event.changedTouches[0];
    // スクロールを検出する簡単な方法
    if (startTouch && Math.abs(startTouch.pageY - endTouch.pageY) < 10) {
      toggleDrawer(true);
    }
  };

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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        size='large'
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          display: { sm: 'none' },
          position: 'fixed',
          bottom: 15,
          right: 30,
          zIndex: 1000,
          backgroundColor: theme.palette.background.default,
          opacity: 1,
        }}
      >
        <MenuIcon />
      </IconButton>

      <Box
        sx={{
          top: 0,
          right: { xs: 0, sm: 'auto' }, // スマホサイズでは右寄せ
          left: { xs: 'auto', sm: 0 }, // それ以外では左寄せ
          borderRight: { xs: 0, sm: `1px solid ${theme.palette.divider}` },
          boxSize: 'border-box',
          width: 240,
          minWidth: 240,
          position: 'fixed',
          zIndex: 1300,
          backgroundColor: darkMode ? { xs: '#353535', sm: theme.palette.background.default } : theme.palette.background.default,
          ...(isMenuVisible ? { display: 'block' } : { display: { xs: 'none', sm: 'block' } }),
        }}
      >
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
      </Box>

      <Box sx={{ display: 'flex' }}>
        <Box component='nav' sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
          <SwipeableDrawer
            anchor='right'
            variant='temporary'
            open={drawerState}
            onOpen={toggleDrawer(true)}
            onClose={toggleDrawer(false)}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': {
                pt: '60px',
                pb: '175px',
                boxSizing: 'border-box',
                width: drawerWidth,
              },
            }}
            onTouchStart={() => setIsSwipe(true)}
            onTouchEnd={() => setIsSwipe(false)}
          >
            {drawerItems}
          </SwipeableDrawer>
          <Drawer
            variant='permanent'
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': {
                pt: '60px',
                boxSizing: 'border-box',
                width: drawerWidth,
                height: 'calc(100% - 115px)',
                maxHeight: 'calc(100% - 115px)',
              },
            }}
            open
          >
            {drawerItems}
          </Drawer>
        </Box>
      </Box>

      <Box
        sx={{
          position: 'fixed',
          right: { xs: 0, sm: 'auto' }, // スマホサイズでは右寄せ
          left: { xs: 'auto', sm: 0 }, // それ以外では左寄せ
          bottom: 0,
          width: 240,
          minWidth: 240,
          borderRight: { xs: 0, sm: `1px solid ${theme.palette.divider}` },
          boxSize: 'border-box',
          zIndex: 1300,
          backgroundColor: darkMode ? { xs: '#353535', sm: theme.palette.background.default } : theme.palette.background.default,
          ...(isMenuVisible ? { display: 'block' } : { display: { xs: 'none', sm: 'block' } }),
        }}
      >
        <Divider />
        <List>
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
        <Divider />
        <List>
          <MenuSettings
            handleFileUpload={handleFileUpload}
            handleDownloadAppState={handleDownloadAppState}
            handleLogout={handleLogout}
          />
        </List>
      </Box>
    </>
  );
}
