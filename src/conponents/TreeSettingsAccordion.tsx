import { useState, useEffect } from 'react';
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
import { TreesList } from './Tree/types';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import ConstructionIcon from '@mui/icons-material/Construction';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useInputDialogStore } from '../store/dialogStore';
import { useDialogStore } from '../store/dialogStore';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface TreeSettingsAccordionProps {
  currentTree: string | null;
  currentTreeName: string | null;
  setCurrentTreeName: (name: string) => void;
  saveCurrentTreeName: (name: string) => void;
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  membersEmails: string[] | null;
  deleteTree: (treeId: string) => void;
}

export function TreeSettingsAccordion({
  currentTree,
  currentTreeName,
  setCurrentTreeName,
  saveCurrentTreeName,
  setTreesList,
  isExpanded,
  setIsExpanded,
  membersEmails,
  deleteTree,
}: TreeSettingsAccordionProps) {
  const [editedTreeName, setEditedTreeName] = useState<string | null>(currentTreeName || '');
  const showDialog = useDialogStore((state) => state.showDialog);
  const showInputDialog = useInputDialogStore((state) => state.showDialog);
  const theme = useTheme();

  useEffect(() => {
    setEditedTreeName(currentTreeName);
  }, [currentTree, currentTreeName]);

  const handleTreeNameChange = (e: string) => {
    setEditedTreeName(e);
  };

  // ツリー名の変更
  const handleButtonClick = () => {
    if (editedTreeName !== null) {
      setCurrentTreeName(editedTreeName);
      saveCurrentTreeName(editedTreeName);
      setTreesList((prev) => {
        if (prev === null) {
          return null;
        }
        return {
          ...prev,
          [currentTree as string]: editedTreeName,
        };
      });
    }
  };

  const handleAddUserToTree = async () => {
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
      const result = await addUserToTreeCallable({ email, currentTree });
      return result.data;
    } catch (error) {
      await showDialog('メンバーの追加に失敗しました。' + error, 'Error');
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
          InputProps={{
            endAdornment: (
              <InputAdornment position='end'>
                <IconButton sx={{ zIndex: 1200, right: 0 }} onClick={handleButtonClick} disabled={!editedTreeName}>
                  <SaveAsIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Typography variant='body1' sx={{ marginTop: 4, ml: 2, textAlign: 'left' }}>
          編集が許可されているメンバー
        </Typography>
        <Divider />
        {membersEmails && (
          <List>
            {membersEmails.map((email, index) => (
              <ListItem key={index} disablePadding>
                <Divider />
                <ListItemText secondary={email} sx={{ width: '100%', ml: 2 }} />
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
                    <HighlightOffIcon />
                  </ListItemIcon>
                </ListItemButton>
              </ListItem>
            ))}
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
