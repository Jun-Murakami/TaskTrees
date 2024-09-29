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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ClearIcon from '@mui/icons-material/Clear';
import { useAppStateStore } from '@/store/appStateStore';

export const QuickMemo = () => {
  const [isEditingTextLocal, setIsEditingTextLocal] = useState(false);
  const [textFieldRows, setTextFieldRows] = useState(6);
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded);
  const setIsQuickMemoExpanded = useAppStateStore((state) => state.setIsQuickMemoExpanded);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const setIsEditingText = useAppStateStore((state) => state.setIsEditingText);

  const darkMode = useAppStateStore((state) => state.darkMode);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const handleResize = () => {
      if (window.innerHeight < 600 || isMobile) {
        setTextFieldRows(6);
      } else {
        setTextFieldRows(14);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // コンポーネントのアンマウント時にイベントリスナーを削除
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          zIndex: 900,
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
        <Accordion
          sx={{
            p: 0,
            height: isQuickMemoExpanded
              ? window.innerHeight < 600 || isMobile
                ? 'calc(215px + env(safe-area-inset-bottom))'
                : 'calc(405px + env(safe-area-inset-bottom))'
              : 'calc(40px + env(safe-area-inset-bottom))',
            paddingBottom: 'env(safe-area-inset-bottom)',
            backgroundColor: darkMode
              ? isQuickMemoExpanded
                ? 'rgba(20, 30, 36, 0.8)'
                : 'rgba(20, 30, 36, 0.6)'
              : isQuickMemoExpanded
              ? 'rgba(230, 240, 246, 0.8)'
              : 'rgba(230, 240, 246, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: '8px 8px 0 0 !important',
            '& .MuiAccordionSummary-expandIconWrapper > .MuiSvgIcon-root': {
              transform: 'rotate(180deg)',
            },
            '& .MuiAccordionSummary-expandIconWrapper': {
              marginTop: isQuickMemoExpanded ? -2 : -1,
            },
          }}
          expanded={isQuickMemoExpanded}
          onChange={async () => {
            {
              setIsQuickMemoExpanded(!isQuickMemoExpanded);
            }
          }}
        >
          <AccordionSummary
            aria-controls='panel1a-content'
            id='panel1a-header'
            expandIcon={<ExpandMoreIcon />}
            sx={{
              height: 40,
              paddingX: 2,
              backgroundColor: 'transparent !important',
            }}
          >
            <Stack
              direction='row'
              sx={{
                width: '100%',
                margin: '0 auto',
                marginTop: isQuickMemoExpanded ? -1.5 : -0.25,
              }}
            >
              <DriveFileRenameOutlineIcon sx={{ color: theme.palette.primary.main, marginTop: -1 }} />
              {!isQuickMemoExpanded && (
                <Typography variant='body2' sx={{ width: '100%', textAlign: 'center', marginTop: -0.5 }}>
                  クイックメモ
                </Typography>
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ marginTop: -3 }}>
            <TextField
              label='クイックメモ'
              variant='outlined'
              size='small'
              multiline
              fullWidth
              autoFocus
              rows={textFieldRows}
              value={quickMemoText}
              onChange={(e) => setQuickMemoText(e.target.value)}
              onFocus={() => {
                setIsEditingText(true);
                setIsEditingTextLocal(true);
              }}
              onBlur={() => {
                setIsEditingText(false);
                setIsEditingTextLocal(false);
              }}
              sx={{ backgroundColor: theme.palette.background.paper }}
            />
            {isEditingTextLocal && isMobile && (
              <IconButton
                sx={{
                  position: 'absolute',
                  color: theme.palette.grey[500],
                  bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
                  right: 15,
                }}
              >
                <SaveAsIcon />
              </IconButton>
            )}
            {isQuickMemoExpanded && quickMemoText && quickMemoText !== '' && (
              <IconButton
                sx={{
                  position: 'absolute',
                  color: theme.palette.grey[500],
                  bottom:
                    window.innerHeight < 600 || isMobile
                      ? 'calc(env(safe-area-inset-bottom) + 125px)'
                      : 'calc(env(safe-area-inset-bottom) + 318px)',
                  right: 15,
                }}
                onClick={() => setQuickMemoText('')}
              >
                <ClearIcon />
              </IconButton>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
    </>
  );
};
