import { useState, useEffect, CSSProperties } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { Box, Button } from '@mui/material';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import { useAppStateStore } from '../../store/appStateStore';

interface Props {
  id: UniqueIdentifier;
}

export function AddTask({ id, ...Props }: Props) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };
  const [isScrolled, setIsScrolled] = useState(false);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);

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
        ref={setNodeRef}
        style={style}
        key={id}
        sx={{ width: '100%', minWidth: '100%', height: { xs: '10px', sm: '50px' }, mb: isAccordionExpanded ? 5 : 0.5 }}
        {...attributes}
        {...listeners}
        {...(transform ? { transform: CSS.Transform.toString(transform) } : {})}
      >
        <Box
          sx={{
            display: isDragging ? 'none' : { xs: 'none', sm: 'block' }, // スマホサイズで非表示
            position: isScrolled ? 'fixed' : 'relative', // スクロールに応じて位置を固定
            top: isScrolled || isAccordionExpanded ? 25 : 'auto', // スクロール時は上部に固定
            left: '50%', // スクロール時は左端に固定
            transform: isScrolled ? 'translateX(calc(-50% + 120px))' : 'translateX(calc(-50%))', //X軸方向に-50%移動して中央寄せからさらに右に240pxずらす
            zIndex: 1900, // スクロール時は他の要素より前面に
            width: '80%',
            maxWidth: '600px',
          }}
        >
          <Button
            variant='contained'
            color='primary'
            startIcon={<DragHandleIcon />}
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
        <Button
          variant='contained'
          color='primary'
          startIcon={<DragHandleIcon />}
          sx={{
            zIndex: 1400,
            display: isDragging ? 'none' : { xs: 'flex', sm: 'none' }, // スマホサイズでのみ表示
            position: 'fixed',
            width: '50%', // 幅を40%に設定
            bottom: 20,
            left: '50%', // 左端から50%の位置に設定
            transform: 'translateX(-50%)', // X軸方向に-50%移動して中央寄せ
            touchAction: 'none',
            cursor: Props ? 'grab' : 'grabbing',
          }}
          disabled={isDragging}
        >
          タスク追加
        </Button>
      </Box>
    </>
  );
}
