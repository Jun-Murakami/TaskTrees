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
import { useDialogStore } from '@/store/dialogStore';

export const QuickMemo = () => {
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded);
  const setIsQuickMemoExpanded = useAppStateStore((state) => state.setIsQuickMemoExpanded);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);

  const [isEditingTextLocal, setIsEditingTextLocal] = useState(false);
  const [quickMemoLocalText, setQuickMemoLocalText] = useState(quickMemoText);

  const showDialog = useDialogStore((state) => state.showDialog);
  const darkMode = useAppStateStore((state) => state.darkMode);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  return (
    <>
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
        <Accordion
          sx={{
            p: 0,
            height: isQuickMemoExpanded
              ? 'calc(385px + env(safe-area-inset-bottom))'
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
              rows={13}
              value={quickMemoLocalText}
              onChange={handleChange}
              onFocus={() => {
                setIsEditingTextLocal(true);
              }}
              onBlur={() => {
                setIsEditingTextLocal(false);
              }}
              sx={{ backgroundColor: theme.palette.background.paper }}
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
            {isQuickMemoExpanded && quickMemoText && quickMemoText !== '' && (
              <IconButton
                sx={{
                  position: 'absolute',
                  color: theme.palette.grey[500],
                  bottom: 'calc(env(safe-area-inset-bottom) + 340px)',
                  right: 45,
                }}
                onClick={handleClear}
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
