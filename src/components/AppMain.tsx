import { useState, useEffect } from 'react';
import { Button, Box, Typography } from '@mui/material';
import { TreeSettingsAccordion } from './TreeSettingsAccordion';
import { SortableTree } from './SortableTree/SortableTree';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useTaskManagement } from '../hooks/useTaskManagement';
import AddIcon from '@mui/icons-material/Add';

interface AppProps {
  deleteTree: (treeId: string) => void;
}

function AppMain({ deleteTree }: AppProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const currentTree = useTreeStateStore((state) => state.currentTree);

  // タスクを管理するカスタムフック
  const {
    handleSelect,
    handleAddTask,
    handleRemove,
    handleValueChange,
    handleDoneChange,
    handleCopy,
    handleMove,
    handleRestore,
  } = useTaskManagement();

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
        <TreeSettingsAccordion deleteTree={deleteTree} />
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
          handleRemove={handleRemove}
          handleValueChange={handleValueChange}
          handleDoneChange={handleDoneChange}
          handleCopy={handleCopy}
          handleMove={handleMove}
          handleRestore={handleRestore}
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
