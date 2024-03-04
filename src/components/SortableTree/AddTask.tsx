import { useState, useEffect } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Box, Button } from '@mui/material';
import SwipeUpIcon from '@mui/icons-material/SwipeUp';
import ReplyIcon from '@mui/icons-material/Reply';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useAppStateStore } from '../../store/appStateStore';

interface Props {
  id: UniqueIdentifier;
}

export function AddTask({ id, ...Props }: Props) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  const [isScrolled, setIsScrolled] = useState(false);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);

  const theme = useTheme();
  const matchesSM = useMediaQuery(theme.breakpoints.up('sm'));

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
    <>
      <Box
        sx={{
          height: '50px',
          display: isScrolled ? { xs: 'none', sm: 'block' } : 'none', // スクロール時は表示
        }}
      />
      <Box
        key={id}
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        sx={{
          display: { xs: 'flex', sm: 'block' },
          position: isScrolled ? 'fixed' : { xs: 'fixed', sm: 'relative' }, // スクロールに応じて位置を固定
          top: isScrolled || isAccordionExpanded ? { xs: 'auto', sm: 25 } : 'auto', // スクロール時は上部に固定
          left: '50%',
          bottom: { xs: 20, sm: 'auto' },
          marginBottom: isAccordionExpanded ? { xs: 'auto', sm: 5 } : 'auto',
          transform: isScrolled ? { xs: 'translateX(-50%)', sm: 'translateX(calc(-50% + 120px))' } : 'translateX(-50%)', //X軸方向に-50%移動して中央寄せからさらに右に240pxずらす
          zIndex: 1000, // スクロール時は他の要素より前面に
          height: { xs: '40px', sm: '50px' },
          width: { xs: '50%', sm: '80%' },
          maxWidth: '600px',
        }}
      >
        <Button
          data-id='add-task-button'
          variant='contained'
          color='primary'
          startIcon={matchesSM ? <ReplyIcon sx={{ transform: 'rotate(-90deg)' }} /> : <SwipeUpIcon />}
          sx={{
            width: '100%',
            maxWidth: '400px',
            whiteSpace: 'nowrap',
            touchAction: 'none',
            cursor: Props ? 'grab' : 'grabbing',
          }}
          disabled={isDragging}
        >
          タスクを追加
        </Button>
      </Box>
    </>
  );
}
