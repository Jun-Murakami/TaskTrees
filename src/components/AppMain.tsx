import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { findMaxId, isDescendantOfTrash, isValidAppState } from './SortableTree/utilities';
import { TreeSettingsAccordion } from './TreeSettingsAccordion';
import { SortableTree } from './SortableTree/SortableTree';
import type { TreeItem, TreesList } from '../types/types';
import SettingsMenu from './SettingsMenu';
import { FormControlLabel, Switch, Button, Box, Typography, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useDialogStore } from '../store/dialogStore';

interface AppProps {
  items: TreeItem[];
  setItems: Dispatch<SetStateAction<TreeItem[]>>;
  hideDoneItems: boolean;
  setHideDoneItems: Dispatch<SetStateAction<boolean>>;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
  handleLogout: () => void;
  setIsWaitingForDelete: Dispatch<SetStateAction<boolean>>;
  currentTree: UniqueIdentifier | null;
  currentTreeName: string | null;
  setCurrentTreeName: Dispatch<SetStateAction<string | null>>;
  saveCurrentTreeName: (name: string) => void;
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>;
  isExpanded: boolean;
  setIsExpanded: Dispatch<SetStateAction<boolean>>;
  currentTreeMembers: { uid: string; email: string }[] | null;
  deleteTree: (treeId: string) => void;
  isFocused: boolean;
  setIsFocused: Dispatch<SetStateAction<boolean>>;
}

function AppMain({
  items,
  setItems,
  hideDoneItems,
  setHideDoneItems,
  darkMode,
  setDarkMode,
  handleLogout,
  setIsWaitingForDelete,
  currentTree,
  currentTreeName,
  setCurrentTreeName,
  saveCurrentTreeName,
  setTreesList,
  isExpanded,
  setIsExpanded,
  currentTreeMembers,
  deleteTree,
  isFocused,
  setIsFocused,
}: AppProps) {
  const [lastSelectedItemId, setLastSelectedItemId] = useState<UniqueIdentifier | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAllowShowTree, setIsAllowShowTree] = useState(true);
  const showDialog = useDialogStore((state) => state.showDialog);

  // 選択したアイテムのIDをセットする
  const handleSelect = (id: UniqueIdentifier) => {
    setLastSelectedItemId(id);
  };

  // 完了したアイテムを非表示にする
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHideDoneItems(event.target.checked);
  };

  // ネストされたアイテムからアイテムを検索する
  const containsItemId = (items: TreeItem[], itemId: UniqueIdentifier): boolean => {
    return items.some((item) => item.id === itemId || containsItemId(item.children, itemId));
  };

  // ネストされたアイテムにアイテムを追加する
  const addItemToNestedChildren = (items: TreeItem[], parentId: UniqueIdentifier, newItem: TreeItem): TreeItem[] => {
    return items.map((item) => {
      if (item.id === parentId) {
        if (!item.children) {
          item.children = [];
        }
        item.children.push(newItem);
        return item;
      } else if (item.children) {
        item.children = addItemToNestedChildren(item.children, parentId, newItem);
        return item;
      }
      return item;
    });
  };

  // タスクを追加する
  const handleAddTask = () => {
    const newTaskId = findMaxId(items) + 1;
    const newTask = {
      id: newTaskId.toString(),
      value: '',
      done: false,
      children: [],
    };

    if (
      lastSelectedItemId === 'trash' ||
      (lastSelectedItemId !== null && isDescendantOfTrash(items, lastSelectedItemId)) ||
      lastSelectedItemId === null
    ) {
      // ゴミ箱のルートツリーの直前のルートにタスクを追加
      const newItems = [...items]; // 現在のアイテムのコピーを作成
      const trashIndex = newItems.findIndex((item) => item.id === 'trash');
      if (trashIndex > 0) {
        // ゴミ箱がリストの最初でない場合、ゴミ箱の直前に新しいタスクを挿入
        newItems.splice(trashIndex, 0, newTask);
      } else if (trashIndex === 0) {
        // ゴミ箱がリストの最初の場合、リストの最初に追加
        newItems.unshift(newTask); // 配列の先頭に追加
      } else {
        // ゴミ箱が存在しない場合、何もしない
        return;
      }
      setItems(newItems); // 更新されたアイテムの配列をセット
    } else {
      // itemsをchildren内を含めて再帰的に検索し、選択したアイテムのidが存在しない場合はツリーの最初に追加
      if (!containsItemId(items, lastSelectedItemId)) {
        const newItems = [...items]; // 現在のアイテムのコピーを作成
        newItems.unshift(newTask); // 配列の先頭に追加
        setItems(newItems); // 更新されたアイテムの配列をセット
      } else {
        // 選択したアイテムの直下に新しいアイテムを追加
        const updatedItems = addItemToNestedChildren(items, lastSelectedItemId, newTask);
        setItems(updatedItems);
      }
    }
  };

  // アプリの状態をJSONファイルとしてダウンロードする
  const handleDownloadAppState = () => {
    const appState = { items, hideDoneItems, darkMode };
    const appStateJSON = JSON.stringify(appState, null, 2); // 読みやすい形式でJSONを整形
    const blob = new Blob([appStateJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TaskTree_Backup.json'; // ダウンロードするファイルの名前
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ファイルを読み込んでアプリの状態を復元する
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      await showDialog('ファイルが選択されていません。', 'Information');
      return;
    }

    const result = await showDialog('現在のツリーは上書きされます。本当に復元しますか？', 'Confirmation Required', true);
    if (!result) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      try {
        const appState = JSON.parse(text as string);
        if (!isValidAppState(appState)) {
          await showDialog('無効なファイル形式です。', 'Error');
          return;
        } else {
          setItems(appState.items);
          setHideDoneItems(appState.hideDoneItems);
          setDarkMode(appState.darkMode);
          await showDialog('ファイルが正常に読み込まれました。', 'Information');
        }
      } catch (error) {
        await showDialog('ファイルの読み込みに失敗しました。', 'Error');
      }
    };
    reader.readAsText(file);
  };

  // タスク追加ボタンの表示をスクロールに応じて変更する
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      setIsScrolled(offset > 50); // 50px以上スクロールしたらtrueにする
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // アコーディオンの展開時にツリーの表示を遅延させる
  useEffect(() => {
    if (isExpanded) {
      setIsAllowShowTree(false);
    } else {
      setTimeout(() => {
        setIsAllowShowTree(true);
      }, 250);
    }
  }, [isExpanded]);

  return (
    <Box
      sx={{
        marginLeft: { sm: '240px' }, // smサイズの時だけ左マージンを240pxに設定
        width: { xs: '100%', sm: 'calc(100% - 240px)' }, // smサイズの時だけ幅をResponsiveDrawerの幅を考慮して調整}}
        minHeight: currentTree !== null ? '100vh' : 'auto',
      }}
    >
      {currentTree ? (
        <TreeSettingsAccordion
          currentTree={currentTree}
          currentTreeName={currentTreeName}
          setCurrentTreeName={setCurrentTreeName}
          saveCurrentTreeName={saveCurrentTreeName}
          setTreesList={setTreesList}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          currentTreeMembers={currentTreeMembers}
          deleteTree={deleteTree}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
        />
      ) : (
        <Typography variant='h3'>
          <img
            src='/TaskTrees.svg'
            alt='Task Tree'
            style={{ width: '35px', height: '35px', marginTop: '30px', marginRight: '10px' }}
          />
          TaskTrees
        </Typography>
      )}
      <Box
        sx={{
          maxWidth: '900px', // 最大幅を指定
          width: '100%', // 横幅いっぱいに広がる
          margin: '0 auto', // 中央寄せ
        }}
      >
        <Grid
          container
          spacing={2}
          sx={{
            width: '80%',
            minWidth: '350px',
            maxWidth: '100%',
            margin: '0 auto',
            marginTop: { xs: 0, sm: 0 },
            marginBottom: '30px',
          }}
        >
          {currentTree && isAllowShowTree && (
            <>
              <Grid
                item
                xs={12}
                sm={4}
                sx={{
                  display: { xs: 'none', sm: 'block' }, // スマホサイズで非表示
                  position: isScrolled ? 'fixed' : 'relative', // スクロールに応じて位置を固定
                  top: isScrolled ? 0 : 'auto', // スクロール時は上部に固定
                  left: isScrolled ? '50%' : 'auto', // スクロール時は左端に固定
                  transform: isScrolled ? 'translateX(calc(-50% + 120px))' : 'none', // スクロール時はX軸方向に-50%移動して中央寄せからさらに右に240pxずらす
                  zIndex: isScrolled ? 1000 : 'auto', // スクロール時は他の要素より前面に
                  width: isScrolled ? '100%' : 'auto', // スクロール時は幅を100%に
                }}
              >
                <Button
                  variant='contained'
                  color='primary'
                  startIcon={<AddIcon />}
                  sx={{ width: '100%', maxWidth: '400px', whiteSpace: 'nowrap' }}
                  onClick={handleAddTask}
                >
                  タスクを追加
                </Button>
              </Grid>

              <Grid item xs={6} sm={4} sx={{ width: '100%', margin: '0 auto' }}>
                <FormControlLabel
                  control={<Switch checked={hideDoneItems} onChange={handleSwitchChange} />}
                  label={<Typography sx={{ fontSize: '0.9em', whiteSpace: 'nowrap' }}>完了を非表示</Typography>}
                />
              </Grid>
            </>
          )}
          {isAllowShowTree && (
            <Grid item xs={6} sm={4} sx={{ width: '100%', margin: '0 auto' }}>
              <SettingsMenu
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                handleFileUpload={handleFileUpload}
                handleDownloadAppState={handleDownloadAppState}
                handleLogout={handleLogout}
                setIsWaitingForDelete={setIsWaitingForDelete}
                currentTree={currentTree}
              />
            </Grid>
          )}
        </Grid>
        {isAllowShowTree && (
          <SortableTree
            collapsible
            indicator
            removable
            hideDoneItems={hideDoneItems}
            items={items}
            darkMode={darkMode}
            setItems={setItems}
            onSelect={handleSelect}
          />
        )}
        {currentTree && isAllowShowTree && (
          <Button
            variant='contained'
            color='primary'
            startIcon={<AddIcon />}
            onClick={handleAddTask}
            sx={{
              zIndex: 1000,
              display: { xs: 'flex', sm: 'none' }, // スマホサイズでのみ表示
              position: 'fixed',
              width: '50%', // 幅を40%に設定
              bottom: 20,
              left: '50%', // 左端から50%の位置に設定
              transform: 'translateX(-50%)', // X軸方向に-50%移動して中央寄せ
            }}
          >
            タスク追加
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default AppMain;
