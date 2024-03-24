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
  Stack,
  Typography,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useAppStateManagement } from '../hooks/useAppStateManagement';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useTreeManagement } from '../hooks/useTreeManagement';
import { SortableList } from './SortableList/SortableList';
import { MenuSettings } from './MenuSettings';

const drawerWidth = 300;

export function ResponsiveDrawer({ handleLogout }: { handleLogout: () => void }) {
  const [drawerState, setDrawerState] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isSwipe, setIsSwipe] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const darkMode = useAppStateStore((state) => state.darkMode);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const searchKey = useAppStateStore((state) => state.searchKey);
  const setSearchKey = useAppStateStore((state) => state.setSearchKey);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);

  const currentTree = useTreeStateStore((state) => state.currentTree);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const treesList = useTreeStateStore((state) => state.treesList);

  const { saveAppSettingsDb } = useAppStateManagement();
  const { loadCurrentTreeData, handleCreateNewTree } = useTreeManagement();

  useEffect(() => {
    if (drawerState) {
      const setTimer = setTimeout(() => {
        setIsMenuVisible(true);
      }, 170);
      return () => clearTimeout(setTimer);
    } else {
      setIsMenuVisible(false);
      return () => {};
    }
  }, [drawerState]);

  useEffect(() => {
    if (isSwipe && drawerState) {
      setIsMenuVisible(false);
      return () => {};
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
      return () => {};
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

  // ツリーのリストから選択されたツリーを表示する
  const handleListClick = async (treeId: UniqueIdentifier): Promise<void> => {
    await loadCurrentTreeData(treeId);
    setCurrentTree(treeId);
    if (isAccordionExpanded) {
      // 0.5秒後にフォーカスをセット
      setTimeout(() => {
        setIsFocusedTreeName(true);
      }, 500);
    }
  };

  const searchDocument = () => {
    const matchingNodes: Node[] = [];
    const walker = document.createTreeWalker(document.getElementById('root')!, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        return node.nodeValue!.toLowerCase().includes(searchKey.toLowerCase())
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });

    while (walker.nextNode()) {
      matchingNodes.push(walker.currentNode);
    }

    return matchingNodes;
  };

  const selectText = (node: Node, searchKey: string) => {
    const selection = window.getSelection();
    let textNode = node;
    // nodeがテキストノードでない場合、テキストノードを探す
    if (node.nodeType !== Node.TEXT_NODE) {
      textNode = node.childNodes[0]; // 例として最初の子ノードを使用
    }
    const text = textNode.nodeValue!;
    const startIndex = text.toLowerCase().indexOf(searchKey.toLowerCase());
    const endIndex = startIndex + searchKey.length;
    const range = document.createRange();
    //range.selectNode(textNode);
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, endIndex);
    textNode.parentElement?.focus();
    selection!.removeAllRanges();
    textNode.parentElement?.focus();
    selection!.addRange(range);
    console.log('selection:', selection);
  };

  const handlePrevButtonClick = () => {
    const matches = searchDocument();
    if (matches.length === 0) return;
    const newIndex = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(newIndex);
    selectText(matches[newIndex], searchKey);
  };

  const handleNextButtonClick = () => {
    const matches = searchDocument();
    if (matches.length === 0) return;
    const newIndex = (currentIndex + 1) % matches.length;
    setCurrentIndex(newIndex);
    selectText(matches[newIndex], searchKey);
  };

  const drawerItems = (
    <>
      <List sx={{ height: '100%' }}>
        {treesList && <SortableList handleListClick={handleListClick} setDrawerState={setDrawerState} />}
      </List>
      <Box sx={{ display: { xs: 'block', sm: 'none' }, height: '270px', minHeight: '270px' }} />
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
          width: drawerWidth,
          minWidth: drawerWidth,
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
              onClick={async () => {
                await handleCreateNewTree();
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
            disableSwipeToOpen={false}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': {
                pt: '60px',
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
                height: 'calc(100% - 170px)',
                maxHeight: 'calc(100% - 170px)',
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
          width: drawerWidth,
          minWidth: drawerWidth,
          borderRight: { xs: 0, sm: `1px solid ${theme.palette.divider}` },
          boxSize: 'border-box',
          zIndex: 1300,
          backgroundColor: darkMode ? { xs: '#353535', sm: theme.palette.background.default } : theme.palette.background.default,
          ...(isMenuVisible ? { display: 'block' } : { display: { xs: 'none', sm: 'block' } }),
        }}
      >
        <Divider />
        <List>
          <ListItem disablePadding sx={{ pl: 2, pr: 0 }}>
            <Stack spacing={0} direction='row' sx={{ width: '100%' }}>
              <TextField
                label='ツリー内を検索'
                value={searchKey}
                size='small'
                fullWidth
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchKey(event.target.value)}
              />
              <IconButton size='small' sx={{ width: 22, ml: 0.5 }} disabled={searchKey === ''} onClick={handlePrevButtonClick}>
                <KeyboardArrowUpIcon />
              </IconButton>
              <IconButton size='small' sx={{ width: 22, mr: 1 }} disabled={searchKey === ''} onClick={handleNextButtonClick}>
                <KeyboardArrowDownIcon />
              </IconButton>
            </Stack>
          </ListItem>
        </List>
        <Divider />
        <List>
          <ListItem disablePadding sx={{ pl: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={hideDoneItems}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setHideDoneItems(event.target.checked);
                    saveAppSettingsDb(darkMode, event.target.checked);
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
        <List>
          <MenuSettings handleLogout={handleLogout} />
        </List>
      </Box>
    </>
  );
}
