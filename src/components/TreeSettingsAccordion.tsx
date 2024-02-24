import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@mui/material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Box,
} from '@mui/material';
import { TreesList } from '../types/types';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConstructionIcon from '@mui/icons-material/Construction';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useInputDialogStore } from '../store/dialogStore';
import { useDialogStore } from '../store/dialogStore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { UniqueIdentifier } from '@dnd-kit/core';

interface TreeSettingsAccordionProps {
  currentTree: UniqueIdentifier | null;
  currentTreeName: string | null;
  setCurrentTreeName: (name: string) => void;
  saveCurrentTreeName: (name: string) => void;
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  currentTreeMembers: { uid: string; email: string }[] | null;
  deleteTree: (treeId: string) => void;
  isFocused: boolean;
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>;
}

export function TreeSettingsAccordion({
  currentTree,
  currentTreeName,
  setCurrentTreeName,
  saveCurrentTreeName,
  setTreesList,
  isExpanded,
  setIsExpanded,
  currentTreeMembers,
  deleteTree,
  isFocused,
  setIsFocused,
}: TreeSettingsAccordionProps) {
  const [editedTreeName, setEditedTreeName] = useState<string | null>(currentTreeName || '');
  const showDialog = useDialogStore((state) => state.showDialog);
  const showInputDialog = useInputDialogStore((state) => state.showDialog);
  const theme = useTheme();

  useEffect(() => {
    setEditedTreeName(currentTreeName);
  }, [currentTree, currentTreeName]);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      setIsFocused(false);
    }
  }, [isFocused, setIsFocused]);

  const handleTreeNameChange = (e: string) => {
    setEditedTreeName(e);
  };

  const inputRef = useRef<HTMLInputElement>(null);

  // ツリー名の変更
  const handleButtonClick = () => {
    if (editedTreeName !== null) {
      setCurrentTreeName(editedTreeName);
      saveCurrentTreeName(editedTreeName);
      setTreesList(
        (prev) =>
          prev &&
          prev.map((tree) => {
            if (tree.id === currentTree) {
              return { ...tree, name: editedTreeName };
            }
            return tree;
          })
      );
    }
  };

  // メンバーの追加
  const handleAddUserToTree = async () => {
    if (!currentTree) return;
    const email = await showInputDialog(
      '追加する編集メンバーのメールアドレスを入力してください',
      'Add Member',
      'Email',
      null,
      false
    );
    if (!email) return;
    const functions = getFunctions();
    const addUserToTreeCallable = httpsCallable(functions, 'addUserToTree');
    try {
      const result = await addUserToTreeCallable({ email, treeId: currentTree });
      return result.data;
    } catch (error) {
      await showDialog('メンバーの追加に失敗しました。メールアドレスを確認して再度実行してください。' + error, 'Error');
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
        const result = await removeUserFromTreeCallable({ treeId: currentTree, userId: uid });
        return result.data;
      } catch (error) {
        await showDialog('メンバーの削除に失敗しました。' + error, 'Error');
      }
    }
  };

  // ツリーの削除
  const handleDeleteTree = async () => {
    const result = await showDialog(
      'すべての編集メンバーからツリーが削除されます。この操作は元に戻せません。削除を実行しますか？',
      'Confirmation Required',
      true
    );
    if (result) {
      deleteTree(currentTree as string);
    }
  };

  return (
    <Accordion sx={{ width: '100%', marginBottom: 2 }} expanded={isExpanded} onChange={() => setIsExpanded(!isExpanded)}>
      <AccordionSummary aria-controls='panel1a-content' id='panel1a-header' expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ width: '100%' }}>{currentTreeName}</Typography>
        <ConstructionIcon sx={{ color: theme.palette.text.secondary, right: 1 }} />
      </AccordionSummary>
      <AccordionDetails>
        <TextField
          id='outlined-basic'
          InputLabelProps={{
            shrink: editedTreeName !== '',
          }}
          label='Tree Name'
          fullWidth
          size='small'
          value={editedTreeName || ''}
          onChange={(e) => handleTreeNameChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && editedTreeName) {
              handleButtonClick();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position='end'>
                <IconButton sx={{ zIndex: 1200, right: 0 }} onClick={handleButtonClick} disabled={!editedTreeName}>
                  <SaveAsIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          inputRef={inputRef}
        />
        <Typography variant='body1' sx={{ marginTop: 4, ml: 2, textAlign: 'left' }}>
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

        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <Button variant={'outlined'} sx={{ mr: 2 }} startIcon={<AddIcon />} color='inherit' onClick={handleAddUserToTree}>
            メンバーの追加
          </Button>
          <Button variant={'outlined'} startIcon={<DeleteForeverIcon />} color='error' onClick={handleDeleteTree}>
            ツリーを削除
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
