import { useState, useEffect } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { findMaxId, isDescendantOfTrash } from './SortableTree/utilities';
import { TreeSettingsAccordion } from './TreeSettingsAccordion';
import { SortableTree } from './SortableTree/SortableTree';
import { TreeItem, Projected } from '../types/types';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { Button, Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface AppProps {
  saveCurrentTreeName: (name: string) => void;
  deleteTree: (treeId: string) => void;
  activeId: UniqueIdentifier | null;
  overId: UniqueIdentifier | null;
  offsetLeft: number;
  projected: Projected | null;
  setProjected: (projected: Projected | null) => void;
  items: TreeItem[];
  setItems: (items: TreeItem[]) => void;
}

function AppMain({
  saveCurrentTreeName,
  deleteTree,
  activeId,
  overId,
  offsetLeft,
  projected,
  setProjected,
  items,
  setItems,
}: AppProps) {
  const [lastSelectedItemId, setLastSelectedItemId] = useState<UniqueIdentifier | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);

  const currentTree = useTreeStateStore((state) => state.currentTree);

  // 選択したアイテムのIDをセットする
  const handleSelect = (id: UniqueIdentifier) => {
    setLastSelectedItemId(id);
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

  // タスク追加ボタンの表示をスクロールに応じて変更する
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      setIsScrolled(offset > 50); // 50px以上スクロールしたらtrueにする
    };

    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Box
      sx={{
        marginLeft: { sm: '240px' }, // smサイズの時だけ左マージンを240pxに設定
        width: { xs: '100%', sm: 'calc(100% - 240px)' }, // smサイズの時だけ幅をResponsiveDrawerの幅を考慮して調整}}
        minHeight: currentTree !== null ? '100vh' : 'auto',
      }}
    >
      {currentTree ? (
        <TreeSettingsAccordion saveCurrentTreeName={saveCurrentTreeName} deleteTree={deleteTree} />
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
        {currentTree && (
          <Box sx={{ width: '100%', minWidth: '100%', height: { xs: '10px', sm: '50px' }, mb: isAccordionExpanded ? 5 : 0.5 }}>
            <Box
              sx={{
                display: { xs: 'none', sm: 'block' }, // スマホサイズで非表示
                position: isScrolled ? 'fixed' : 'relative', // スクロールに応じて位置を固定
                top: isScrolled || isAccordionExpanded ? 25 : 'auto', // スクロール時は上部に固定
                left: '50%', // スクロール時は左端に固定
                transform: isScrolled ? 'translateX(calc(-50% + 120px))' : 'translateX(calc(-50%))', //X軸方向に-50%移動して中央寄せからさらに右に240pxずらす
                zIndex: isScrolled ? 1000 : 'auto', // スクロール時は他の要素より前面に
                width: '80%',
                maxWidth: '600px',
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
            </Box>
          </Box>
        )}
        <SortableTree
          collapsible
          indicator
          removable
          onSelect={handleSelect}
          activeId={activeId}
          overId={overId}
          offsetLeft={offsetLeft}
          projected={projected}
          setProjected={setProjected}
          items={items}
          setItems={setItems}
        />
        {currentTree && (
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
