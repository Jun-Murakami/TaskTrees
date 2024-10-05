import type { UniqueIdentifier } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Box, Button } from '@mui/material';
import SwipeUpIcon from '@mui/icons-material/SwipeUp';
import ReplyIcon from '@mui/icons-material/Reply';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useAppStateStore } from '@/store/appStateStore';

interface Props {
  id: UniqueIdentifier;
}

export function AddTask({ id, ...Props }: Props) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <>
      {!(isMobile && isQuickMemoExpanded) && (
        <Box
          key={id}
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          sx={{
            display: { xs: 'flex', sm: 'block' },
            position: 'fixed', // スクロールに応じて位置を固定
            top: { xs: 'auto', sm: 'calc(env(safe-area-inset-top) + 80px)' }, // スクロール時は上部に固定
            left: '50%',
            '@media (min-width: 1249px) and (max-width: 1546px)': {
              left: { xs: '50%', sm: '765px' },
            },
            '@media (max-width: 1249px)': {
              left: { xs: '50%', sm: 'calc((100vw - (100vw - 100%) - 300px) / 2 + 300px)' },
            },
            transform: 'translateX(-50%)',
            bottom: { xs: 'calc(env(safe-area-inset-bottom) + 60px)', sm: 'auto' },
            marginBottom: isAccordionExpanded ? { xs: 'auto', sm: 5 } : 'auto',
            zIndex: 900, // スクロール時は他の要素より前面に
            height: { xs: '40px', sm: '50px' },
            width: { xs: '50%', sm: '80%' },
            maxWidth: '400px',
            touchAction: 'none',
          }}
        >
          <Button
            data-id='add-task-button'
            variant='contained'
            color='primary'
            startIcon={isMobile ? <SwipeUpIcon /> : <ReplyIcon sx={{ transform: 'rotate(-90deg)' }} />}
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
      )}
    </>
  );
}
