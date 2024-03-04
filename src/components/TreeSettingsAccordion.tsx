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
import { useInputDialogStore } from '../store/dialogStore';
import { useDialogStore } from '../store/dialogStore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useDatabase } from '../hooks/useDatabase';

interface TreeSettingsAccordionProps {
  deleteTree: (treeId: string) => void;
}

export function TreeSettingsAccordion({ deleteTree }: TreeSettingsAccordionProps) {
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const setIsAccordionExpanded = useAppStateStore((state) => state.setIsAccordionExpanded);
  const isFocusedTreeName = useAppStateStore((state) => state.isFocusedTreeName);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);

  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const currentTreeMembers = useTreeStateStore((state) => state.currentTreeMembers);

  const [editedTreeName, setEditedTreeName] = useState<string | null>(currentTreeName || '');

  const showDialog = useDialogStore((state) => state.showDialog);
  const showInputDialog = useInputDialogStore((state) => state.showDialog);

  const { saveCurrentTreeNameDb, saveTreesListDb } = useDatabase();

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

  // ツリー名の変更
  const handleTreeNameSubmit = () => {
    if (editedTreeName !== null && editedTreeName !== '' && editedTreeName !== currentTreeName) {
      setCurrentTreeName(editedTreeName);
      saveCurrentTreeNameDb(editedTreeName, currentTree);
      if (treesList) {
        const newList = treesList.map((tree) => {
          if (tree.id === currentTree) {
            return { ...tree, name: editedTreeName };
          }
          return tree;
        });
        setTreesList(newList);
        saveTreesListDb(newList);
      }
    } else {
      setEditedTreeName(currentTreeName);
    }
  };

  // メンバーの追加
  const handleAddUserToTree = async () => {
    if (!currentTree) return;
    const email = await showInputDialog(
      '追加する編集メンバーのメールアドレスを入力してください。共有メンバーはこのアプリにユーザー登録されている必要があります。',
      'Add Member',
      'Email',
      null,
      false
    );
    if (!email) return;
    const functions = getFunctions();
    const addUserToTreeCallable = httpsCallable(functions, 'addUserToTree');
    try {
      const result = await addUserToTreeCallable({
        email,
        treeId: currentTree,
      });
      return result.data;
    } catch (error) {
      await showDialog('メンバーの追加に失敗しました。メールアドレスを確認して再度実行してください。' + error, 'IInformation');
    }
  };

  // メンバーの削除
  const handleDeleteUserFromTree = async (uid: string, email: string) => {
    if (!currentTree) return;
    const user = getAuth().currentUser;
    let result;
    if (currentTreeMembers && currentTreeMembers.length === 1) {
      await showDialog('最後のメンバーを削除することはできません。', 'Information');
      return;
    }
    if (user && user.uid === uid) {
      result = await showDialog(
        '自分自身を削除すると、このツリーにアクセスできなくなります。実行しますか？',
        'Confirmation Required',
        true
      );
    } else {
      result = await showDialog(
        `メンバー' ${email} 'をこのツリーの編集メンバーから削除します。実行しますか？`,
        'Confirmation Required',
        true
      );
    }
    if (result) {
      const functions = getFunctions();
      const removeUserFromTreeCallable = httpsCallable(functions, 'removeUserFromTree');
      try {
        const result = await removeUserFromTreeCallable({
          treeId: currentTree,
          userId: uid,
        });
        return result.data;
      } catch (error) {
        await showDialog('メンバーの削除に失敗しました。' + error, 'Error');
      }
    }
  };

  // ツリーの削除
  const handleDeleteTree = async () => {
    const result = await showDialog(
      'すべての編集メンバーからツリーが削除されます。この操作は元に戻せません。実行しますか？',
      'Confirmation Required',
      true
    );
    if (result) {
      deleteTree(currentTree as string);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '900px', marginX: 'auto', marginBottom: isAccordionExpanded ? { xs: 2, sm: 0 } : 0 }}>
      <Accordion
        sx={{
          marginBottom: 2,
          marginTop: 0,
          '& .MuiPaper-root': {
            borderRadius: '0 0 8px 8px !important',
            backgroundColor: 'transparent !important',
          },
          '& .MuiButtonBase-root': {
            backgroundColor: 'transparent !important',
          },
          borderRadius: '0 0 8px 8px !important',
        }}
        expanded={isAccordionExpanded}
        onChange={() => {
          {
            if (isAccordionExpanded) {
              handleTreeNameSubmit();
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
            '&.Mui-focused, &:hover': {
              backgroundColor: 'transparent !important',
            },
            height: 40,
            paddingY: isAccordionExpanded ? '60px' : '30px',
            paddingX: 2,
          }}
        >
          <Stack direction='row' sx={{ height: 40, width: '100%', margin: '0 auto' }}>
            <img src='/TaskTrees.svg' alt='Task Tree' style={{ width: '28px', height: '28px', marginTop: 5 }} />
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editedTreeName) {
                    handleTreeNameSubmit();
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
              <Typography sx={{ width: '100%', marginTop: '6px' }}>{currentTreeName}</Typography>
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
                        <HighlightOffIcon onClick={() => handleDeleteUserFromTree(member.uid, member.email)} />
                      </ListItemIcon>
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
              ))}
              <Divider />
            </List>
          )}

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 1,
            }}
          >
            <Button variant={'outlined'} sx={{ mr: 2 }} startIcon={<AddIcon />} color='inherit' onClick={handleAddUserToTree}>
              メンバーの追加
            </Button>
            <Button variant={'outlined'} startIcon={<DeleteForeverIcon />} color='error' onClick={handleDeleteTree}>
              ツリーを削除
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
