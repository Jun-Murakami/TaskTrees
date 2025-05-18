import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  useMediaQuery,
  Box,
  Stack,
  Typography,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ClearIcon from '@mui/icons-material/Clear';
import { useAppStateStore } from '@/store/appStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { Rnd } from 'react-rnd';

const ROW_HEIGHT = 23;// 1行あたりの高さ(px)の目安

export const QuickMemo = () => {
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded);
  const setIsQuickMemoExpanded = useAppStateStore((state) => state.setIsQuickMemoExpanded);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const isQuickMemoDocked = useAppStateStore((state) => state.isQuickMemoDocked);
  const setIsQuickMemoDocked = useAppStateStore((state) => state.setIsQuickMemoDocked);
  const quickMemoPosition = useAppStateStore((state) => state.quickMemoPosition);
  const setQuickMemoPosition = useAppStateStore((state) => state.setQuickMemoPosition);
  const quickMemoSize = useAppStateStore((state) => state.quickMemoSize);
  const setQuickMemoSize = useAppStateStore((state) => state.setQuickMemoSize);

  const [isEditingTextLocal, setIsEditingTextLocal] = useState(false);
  const [quickMemoLocalText, setQuickMemoLocalText] = useState(quickMemoText);
  const [dynamicRows, setDynamicRows] = useState(3);

  const showDialog = useDialogStore((state) => state.showDialog);
  const darkMode = useAppStateStore((state) => state.darkMode);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // モバイル時は常にドック状態
  useEffect(() => {
    if (isMobile && !isQuickMemoDocked) {
      setIsQuickMemoDocked(true);
    }
  }, [isMobile, isQuickMemoDocked, setIsQuickMemoDocked]);

  // ウィンドウリサイズ時に画面外補正
  useEffect(() => {
    if (isQuickMemoDocked || isMobile) return;
    const handleResize = () => {
      const { innerWidth, innerHeight } = window;
      let { x, y } = quickMemoPosition;
      const { width, height } = quickMemoSize;
      let changed = false;
      if (x + width > innerWidth) { x = Math.max(0, innerWidth - width); changed = true; }
      if (y + height > innerHeight) { y = Math.max(0, innerHeight - height); changed = true; }
      if (x < 0) { x = 0; changed = true; }
      if (y < 0) { y = 0; changed = true; }
      if (changed) setQuickMemoPosition({ x, y });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isQuickMemoDocked, isMobile, quickMemoPosition, quickMemoSize, setQuickMemoPosition]);

  // 切り離し時は常にエクスパンド状態にする
  useEffect(() => {
    if (!isQuickMemoDocked && !isQuickMemoExpanded) {
      setIsQuickMemoExpanded(true);
    }
  }, [isQuickMemoDocked, isQuickMemoExpanded, setIsQuickMemoExpanded]);

  // フロート状態のとき、TextFieldのrowsを動的に調整
  useEffect(() => {
    if (!isQuickMemoDocked && !isMobile) {
      const boxHeight = quickMemoSize.height;
      // ラベルやパディング分を差し引く（例: 48px）
      const rows = Math.max(1, Math.floor((boxHeight - 80) / ROW_HEIGHT));
      setDynamicRows(rows);
    }
  }, [quickMemoSize.height, isQuickMemoDocked, isMobile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuickMemoLocalText(e.target.value);
    setTimeout(() => setQuickMemoText(e.target.value), 50);
  };

  const handleClear = async () => {
    const result = await showDialog('クイックメモを削除しますか？', 'Confirm', true);
    if (result) {
      setQuickMemoText('');
    }
  };

  useEffect(() => {
    setQuickMemoLocalText(quickMemoText);
  }, [quickMemoText]);

  // ドック/切り離しトグルボタン（AccordionSummary内で右端に表示するため、Stackに組み込む）
  const dockToggleBtn = !isMobile && (
    <Button
      size="small"
      variant="outlined"
      sx={{ mx: 1, height: 28, alignSelf: 'center' }}
      onClick={(e) => {
        e.stopPropagation(); // Accordionの展開トグルを防ぐ
        setIsQuickMemoDocked(!isQuickMemoDocked);
      }}
    >
      {isQuickMemoDocked ? '切り離す' : 'ドッキング'}
    </Button>
  );

  // クイックメモ本体
  const memoContent = (
    <Accordion
      sx={{
        p: 0,
        height: isQuickMemoDocked || isMobile
          ? (isQuickMemoExpanded
              ? 'calc(385px + env(safe-area-inset-bottom))'
              : 'calc(40px + env(safe-area-inset-bottom))')
          : '100%',
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: darkMode
          ? isQuickMemoExpanded
            ? 'rgba(20, 30, 36, 0.8)'
            : 'rgba(20, 30, 36, 0.6)'
          : isQuickMemoExpanded
          ? 'rgba(230, 240, 246, 0.8)'
          : 'rgba(230, 240, 246, 0.6)',
        backdropFilter: 'blur(8px)',
        borderRadius: isQuickMemoDocked ? '8px 8px 0 0 !important' : '8px 8px 8px 8px !important',
        '& .MuiAccordionSummary-expandIconWrapper > .MuiSvgIcon-root': {
          transform: 'rotate(180deg)',
        },
        '& .MuiAccordionSummary-expandIconWrapper': {
          marginTop: isQuickMemoExpanded ? -2 : -1,
        },
        filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.15))',
      }}
      expanded={isQuickMemoDocked || isMobile ? isQuickMemoExpanded : true}
      onChange={isQuickMemoDocked || isMobile ? () => setIsQuickMemoExpanded(!isQuickMemoExpanded) : undefined}
    >
      <AccordionSummary
        aria-controls='panel1a-content'
        id='panel1a-header'
        expandIcon={isQuickMemoDocked || isMobile ? <ExpandMoreIcon /> : null}
        sx={{
          height: 40,
          paddingX: 2,
          backgroundColor: 'transparent !important',
        }}
        onClick={isQuickMemoDocked || isMobile ? undefined : (e) => e.stopPropagation()}
      >
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          sx={{
            width: '100%',
            margin: '0 auto',
            marginTop: isQuickMemoExpanded ? -1.5 : -0.25,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
            <DriveFileRenameOutlineIcon sx={{ color: theme.palette.primary.main, marginTop: -1 }} />
            {!isQuickMemoExpanded && (
              <Typography variant='body2' sx={{ width: '100%', textAlign: 'center', marginTop: -0.5 }}>
                クイックメモ
              </Typography>
            )}
          </Stack>
          {dockToggleBtn}
                  {isQuickMemoExpanded && quickMemoText && quickMemoText !== '' && (
          <IconButton
            sx={{
              color: theme.palette.grey[500],
            }}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
          >
            <ClearIcon />
          </IconButton>
        )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          marginTop: -3,
          position: 'relative',
          height: isQuickMemoDocked || isMobile ? 'auto' : 'calc(100% - 40px)',
          minHeight: isQuickMemoDocked || isMobile ? undefined : 0,
          p: 0,
        }}
      >
        <TextField
          label='クイックメモ'
          variant='outlined'
          size='small'
          multiline
          rows={isQuickMemoDocked || isMobile ? 13 : dynamicRows}
          fullWidth
          autoFocus
          value={quickMemoLocalText}
          onChange={handleChange}
          onFocus={() => {
            setIsEditingTextLocal(true);
          }}
          onBlur={() => {
            setIsEditingTextLocal(false);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onResize={(e) => {
            e.stopPropagation();
          }}
          sx={{
            height: isQuickMemoDocked || isMobile ? 'auto' : '100%',
            minHeight: isQuickMemoDocked || isMobile ? undefined : 0,
            p: 2,
            zIndex: 1500,
          }}
          slotProps={{
            input: {
              sx: isQuickMemoDocked || isMobile ? { backgroundColor: theme.palette.background.paper } : {
                backgroundColor: theme.palette.background.paper,
                '& .MuiInputBase-root': {
                  
                  height: '100%',
                  alignItems: 'flex-start',
                },
              },
            },
            inputLabel: { sx: { left: 16, top: 16 } },
          }}
        />
        {isEditingTextLocal && isMobile && (
          <IconButton
            sx={{
              position: 'absolute',
              color: theme.palette.grey[500],
              bottom: 'calc(env(safe-area-inset-bottom) + 15px)',
              right: 15,
            }}
          >
            <SaveAsIcon />
          </IconButton>
        )}

      </AccordionDetails>
    </Accordion>
  );

  // ドック状態
  if (isQuickMemoDocked || isMobile) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          zIndex: 1210,
          width: '100%',
          '@media (min-width: 1546px)': {
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '900px',
          },
          '@media (min-width: 1249px) and (max-width: 1546px)': {
            left: { xs: '50%', sm: '315px' },
            maxWidth: '900px',
          },
          '@media (max-width: 1249px)': {
            left: { xs: '50%', sm: '315px' },
            transform: { xs: 'translateX(-50%)', sm: 'none' },
            maxWidth: { xs: '100%', sm: 'calc(100vw - (100vw - 100%) - 330px)' },
          },
          marginX: 'auto',
        }}
      >
        <Box sx={{ position: 'relative' }}>{memoContent}</Box>
      </Box>
    );
  }

  // 切り離し状態
  return (
    <Rnd
      size={quickMemoSize}
      position={quickMemoPosition}
      minWidth={250}
      minHeight={120}
      onDragStop={(_e, d) => {
        const maxX = window.innerWidth - quickMemoSize.width;
        const maxY = window.innerHeight - quickMemoSize.height;
        const x = Math.max(0, Math.min(d.x, maxX));
        const y = Math.max(0, Math.min(d.y, maxY));
        setQuickMemoPosition({ x, y });
      }}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        const width = ref.offsetWidth;
        const height = ref.offsetHeight;
        // 右端・下端がウィンドウ外に出ないように補正
        const maxX = window.innerWidth - width;
        const maxY = window.innerHeight - height;
        const x = Math.max(0, Math.min(position.x, maxX));
        const y = Math.max(0, Math.min(position.y, maxY));
        setQuickMemoSize({ width, height });
        setQuickMemoPosition({ x, y });
      }}
      style={{ zIndex: 1300, position: 'fixed' }}
    >
      <Box sx={{ position: 'relative', height: '100%', }}>{memoContent}</Box>
    </Rnd>
  );
};
