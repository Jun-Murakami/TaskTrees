import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Button,
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
  TextField,
  useMediaQuery,
} from '@mui/material';
import { Add, Menu, KeyboardArrowUp, KeyboardArrowDown, Clear, Archive } from '@mui/icons-material';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useAppStateManagement } from '@/hooks/useAppStateManagement';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { useSearch } from '@/features/homepage/hooks/useSearch';
import { SortableList } from '@/features/sortableList/SortableList';
import { MenuSettings } from './MenuSettings';

const drawerWidth = 300;

export function ResponsiveDrawer({ handleLogout }: { handleLogout: () => void }) {
  const [drawerState, setDrawerState] = useState(false);

  const darkMode = useAppStateStore((state) => state.darkMode);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded);
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const searchKey = useAppStateStore((state) => state.searchKey);
  const setSearchKey = useAppStateStore((state) => state.setSearchKey);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);
  const setIsShowArchive = useAppStateStore((state) => state.setIsShowArchive);

  const currentTree = useTreeStateStore((state) => state.currentTree);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setItems = useTreeStateStore((state) => state.setItems);
  const treesList = useTreeStateStore((state) => state.treesList);

  const { saveAppSettings } = useAppStateManagement();
  const { loadAndSetCurrentTreeDataFromIdb, handleCreateNewTree } = useTreeManagement();
  const { handlePrevButtonClick, handleNextButtonClick } = useSearch();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const handleSearchKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKey(event.target.value);
  };

  // ツリーのリストから選択されたツリーを表示する
  const handleListClick = async (treeId: UniqueIdentifier): Promise<void> => {
    if (currentTree === treeId) {
      return;
    }
    setDrawerState(false);
    setIsShowArchive(false);
    setCurrentTree(treeId);
    await loadAndSetCurrentTreeDataFromIdb(treeId);
    if (isAccordionExpanded) {
      // 0.5秒後にフォーカスをセット
      setTimeout(() => {
        setIsFocusedTreeName(true);
      }, 500);
    }
  };

  const drawerItems = (
    <>
      <Box
        sx={{
          position: 'absolute',
          top: 'env(safe-area-inset-top)',
          right: { xs: 0, sm: 'auto' }, // スマホサイズでは右寄せ
          left: { xs: 'auto', sm: 0 }, // それ以外では左寄せ
          width: '100%',
          backgroundColor: darkMode ? { xs: '#353535', sm: theme.palette.background.default } : theme.palette.background.default,
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
              onClick={async () => {
                setIsShowArchive(false);
                await handleCreateNewTree();
                setDrawerState(false);
              }}
            >
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText secondary='新しいツリーを作成' />
            </ListItemButton>
          </ListItem>
        </List>
        <Divider />
      </Box>

      <Box sx={{ height: 'calc(100% - (166px + env(safe-area-inset-bottom)))', overflowY: 'auto' }}>
        <List>
          {treesList && <SortableList handleListClick={handleListClick} setDrawerState={setDrawerState} />}
          <ListItem disablePadding>
            <ListItemButton
              sx={{ opacity: 1, height: 50 }}
              onClick={() => {
                setCurrentTree(null);
                setCurrentTreeName(null);
                setItems([]);
                setIsShowArchive(true);
                setDrawerState(false);
              }}
            >
              <Button sx={{ width: '20px', minWidth: '20px', height: '20px', mr: '10px', color: theme.palette.grey[500] }}>
                <Archive />
              </Button>
              <ListItemText secondary='アーカイブ済み' />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          right: { xs: 0, sm: 'auto' }, // スマホサイズでは右寄せ
          left: { xs: 'auto', sm: 0 }, // それ以外では左寄せ
          width: '100%',
          bottom: 'env(safe-area-inset-bottom)',
          backgroundColor: darkMode ? { xs: '#353535', sm: theme.palette.background.default } : theme.palette.background.default,
        }}
      >
        <Divider />
        <List>
          <ListItem disablePadding sx={{ pl: 2, pr: { xs: 2, sm: 0 } }}>
            <TextField
              label='ツリー内を検索'
              variant='outlined'
              value={searchKey}
              size='small'
              fullWidth
              onChange={handleSearchKeyChange}
              slotProps={{
                input: {
                  endAdornment: searchKey ? (
                    <IconButton size='small' onClick={() => setSearchKey('')} sx={{ mr: -1, color: theme.palette.action.active }}>
                      <Clear />
                    </IconButton>
                  ) : undefined,
                },
              }}
            />
            {!isMobile && (
              <>
                <IconButton size='small' sx={{ width: 22, ml: 0.5 }} disabled={searchKey === ''} onClick={handlePrevButtonClick}>
                  <KeyboardArrowUp />
                </IconButton>
                <IconButton size='small' sx={{ width: 22, mr: 1 }} disabled={searchKey === ''} onClick={handleNextButtonClick}>
                  <KeyboardArrowDown />
                </IconButton>
              </>
            )}
          </ListItem>
        </List>
        <Divider />
        <List>
          <ListItem disablePadding sx={{ pl: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={hideDoneItems}
                  onChange={async (event: React.ChangeEvent<HTMLInputElement>) => {
                    setHideDoneItems(event.target.checked);
                    await saveAppSettings(darkMode, event.target.checked);
                  }}
                />
              }
              label={
                <Typography
                  sx={{
                    fontSize: '0.9em',
                    whiteSpace: 'nowrap',
                    color: theme.palette.text.secondary,
                  }}
                >
                  完了タスクを非表示
                </Typography>
              }
              sx={{ width: '100%' }}
            />
          </ListItem>
        </List>
        <Divider />
        <List sx={{ py: 0.6 }}>
          <MenuSettings handleLogout={handleLogout} />
        </List>
      </Box>
    </>
  );

  const quickMemoSpacer = isQuickMemoExpanded ? 360 : 0;

  return (
    <>
      {!currentTree && treesList.length === 0 && (
        <Typography
          variant='caption'
          sx={{
            display: { sm: 'none' },
            position: 'fixed',
            bottom: `calc(env(safe-area-inset-bottom) + ${quickMemoSpacer}px + 70px)`,
            right: 100,
            zIndex: 1000,
          }}
        >
          タップしてツリーリストを開く →
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
          bottom: `calc(env(safe-area-inset-bottom) + ${quickMemoSpacer}px + 55px)`,
          right: 30,
          zIndex: 1000,
          backgroundColor: theme.palette.background.default,
          opacity: 1,
        }}
      >
        <Menu />
      </IconButton>

      <Box
        component='nav'
        sx={{
          width: { sm: drawerWidth },
          flexShrink: { sm: 0 },
          borderRight: { xs: 0, sm: `1px solid ${theme.palette.divider}` },
          boxSizing: 'border-box',
        }}
      >
        <SwipeableDrawer
          anchor='right'
          variant='temporary'
          open={drawerState}
          onOpen={toggleDrawer(true)}
          onClose={toggleDrawer(false)}
          disableSwipeToOpen={true}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              pt: 'calc(env(safe-area-inset-top) + 60px)',
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawerItems}
        </SwipeableDrawer>
        <Drawer
          variant='permanent'
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              pt: 'calc(env(safe-area-inset-top) + 60px)',
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawerItems}
        </Drawer>
      </Box>
    </>
  );
}
