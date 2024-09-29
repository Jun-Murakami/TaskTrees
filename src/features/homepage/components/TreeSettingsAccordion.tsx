import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Box,
  Stack,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import { TaskTreeLogoIcon } from '@/features/common/TaskTreesLogo';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { Capacitor } from '@capacitor/core';

export function TreeSettingsAccordion() {
  const isOffline = useAppStateStore((state) => state.isOffline);
  const darkMode = useAppStateStore((state) => state.darkMode);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const setIsAccordionExpanded = useAppStateStore((state) => state.setIsAccordionExpanded);
  const isFocusedTreeName = useAppStateStore((state) => state.isFocusedTreeName);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);

  const currentTree = useTreeStateStore((state) => state.currentTree);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);
  const currentTreeMembers = useTreeStateStore((state) => state.currentTreeMembers);

  const [editedTreeName, setEditedTreeName] = useState<string | null>(currentTreeName || '');
  const [isComposing, setIsComposing] = useState(false);

  const { handleTreeNameSubmit, handleAddUserToTree, handleDeleteUserFromTree, handleDeleteTree } = useTreeManagement();

  const theme = useTheme();

  // TextFieldの値をセット
  const handleTreeNameChange = (e: string) => {
    setEditedTreeName(e);
  };

  // TextFielのRefをセット
  const inputRef = useRef<HTMLInputElement>(null);

  // 新しいツリーが呼び出されたらTextFIeldにツリー名をセット
  useEffect(() => {
    setEditedTreeName(currentTreeName);
  }, [currentTree, currentTreeName]);

  // フォーカスをセット
  useEffect(() => {
    if (isFocusedTreeName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      setIsFocusedTreeName(false);
    }
  }, [isFocusedTreeName, setIsFocusedTreeName]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        zIndex: 1000,
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
          marginTop: 0,
          paddingTop: Capacitor.isNativePlatform() ? 'env(safe-area-inset-top)' : 0,
          backgroundColor: darkMode
            ? isAccordionExpanded
              ? 'rgba(18, 18, 18, 0.8)'
              : 'rgba(18, 18, 18, 0.6)'
            : isAccordionExpanded
            ? 'rgba(255, 255, 255, 0.8)'
            : 'rgba(255, 255, 255, 0.6)',

          backdropFilter: 'blur(8px)',
          borderRadius: '0 0 8px 8px !important',
        }}
        expanded={isAccordionExpanded}
        onChange={async () => {
          {
            if (isAccordionExpanded) {
              if (editedTreeName && editedTreeName !== '') {
                await handleTreeNameSubmit(editedTreeName);
              }
            }
            setIsAccordionExpanded(!isAccordionExpanded);
          }
        }}
      >
        <AccordionSummary
          aria-controls='panel1a-content'
          id='panel1a-header'
          expandIcon={<ExpandMoreIcon />}
          sx={{
            height: 40,
            paddingY: isAccordionExpanded ? '60px' : '30px',
            paddingX: 2,
            backgroundColor: 'transparent !important',
          }}
        >
          <Stack direction='row' sx={{ height: 40, width: '100%', margin: '0 auto' }}>
            <TaskTreeLogoIcon sx={{ width: '28px', height: '28px', color: theme.palette.primary.main, mt: 0.5 }} />
            {isAccordionExpanded ? (
              <TextField
                id='outlined-basic'
                InputLabelProps={{
                  shrink: editedTreeName !== '',
                }}
                sx={{ zIndex: 1200, marginTop: 0, marginX: 2 }}
                label='Tree Name'
                fullWidth
                size='small'
                value={editedTreeName || ''}
                onChange={(e) => handleTreeNameChange?.(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && !isComposing) {
                    e.preventDefault(); // エンターキーのデフォルト動作を防ぐ
                    if (editedTreeName && editedTreeName !== '') {
                      await handleTreeNameSubmit(editedTreeName);
                    }
                    setIsAccordionExpanded(false);
                  }
                }}
                InputProps={{
                  inputProps: {
                    style: { textAlign: 'center' },
                  },
                }}
                inputRef={inputRef}
              />
            ) : (
              <Typography sx={{ width: '100%', marginTop: '6px', textAlign: 'center' }}>{currentTreeName}</Typography>
            )}
            {isAccordionExpanded ? (
              <SaveAsIcon sx={{ color: theme.palette.text.secondary, right: 1, marginTop: 1 }} />
            ) : (
              <SettingsIcon sx={{ color: theme.palette.text.secondary, right: 1, marginTop: 1 }} />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant='body1' sx={{ marginTop: -1, ml: 2, textAlign: 'left' }}>
            編集が許可されているメンバー
          </Typography>
          {currentTreeMembers && (
            <List>
              {currentTreeMembers.map((member, index) => (
                <React.Fragment key={index}>
                  <Divider />
                  <ListItem disablePadding>
                    <ListItemText secondary={member.email} sx={{ width: '100%', ml: 2 }} />
                    {!isOffline && (
                      <ListItemButton
                        sx={{
                          '& .MuiListItemIcon-root': {
                            minWidth: 0,
                            width: 24,
                            marginX: 1,
                          },
                        }}
                      >
                        <ListItemIcon>
                          <HighlightOffIcon onClick={async () => await handleDeleteUserFromTree(member.uid, member.email)} />
                        </ListItemIcon>
                      </ListItemButton>
                    )}
                  </ListItem>
                </React.Fragment>
              ))}
              <Divider />
            </List>
          )}

          {!isOffline && (
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 1,
              }}
            >
              <Button
                variant={'outlined'}
                sx={{ mr: 2 }}
                startIcon={<AddIcon />}
                color='inherit'
                onClick={async () => await handleAddUserToTree()}
              >
                メンバーの追加
              </Button>
              <Button
                variant={'outlined'}
                startIcon={<DeleteForeverIcon />}
                color='error'
                onClick={async () => await handleDeleteTree()}
              >
                ツリーを削除
              </Button>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
