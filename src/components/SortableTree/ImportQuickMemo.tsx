import type { UniqueIdentifier } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Box, Button } from '@mui/material';
import SwipeUpIcon from '@mui/icons-material/SwipeUp';
import ReplyIcon from '@mui/icons-material/Reply';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { useAppStateStore } from '../../store/appStateStore';
import { Capacitor } from '@capacitor/core';

interface Props {
  id: UniqueIdentifier;
}

export function ImportQuickMemo({ id, ...Props }: Props) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  const isEditingText = useAppStateStore((state) => state.isEditingText);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isNative = Capacitor.isNativePlatform();

  return (
    <>
      <Box
        key={id}
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        sx={{
          position: 'fixed',
          left: '50%',
          '@media (min-width: 1249px) and (max-width: 1546px)': {
            left: { xs: '50%', sm: '765px' },
          },
          '@media (max-width: 1249px)': {
            left: { xs: '50%', sm: 'calc((100vw - (100vw - 100%) - 300px) / 2 + 300px)' },
          },
          transform: 'translateX(-50%)',
          bottom: isNative ? 'calc(env(safe-area-inset-bottom) + 176px)' : 176,
          zIndex: 900,
          height: '30px',
          width: '50%',
          maxWidth: '250px',
        }}
      >
        <Button
          data-id='import-quick-memo-button'
          variant='contained'
          color='primary'
          startIcon={isMobile ? <SwipeUpIcon /> : <ReplyIcon sx={{ transform: 'scale(-1, 1) rotate(60deg)' }} />}
          sx={{
            width: '100%',
            maxWidth: '250px',
            whiteSpace: 'nowrap',
            touchAction: 'none',
            cursor: Props ? 'grab' : 'grabbing',
            height: '30px',
          }}
          disabled={isDragging || (isEditingText && isMobile) || quickMemoText === ''}
        >
          メモを取り込む
        </Button>
      </Box>
    </>
  );
}
