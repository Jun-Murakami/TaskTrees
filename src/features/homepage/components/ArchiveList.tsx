import React, { useEffect, useState } from 'react';
import { useTreeStateStore } from '@/store/treeStateStore';
import { UniqueIdentifier } from '@dnd-kit/core';
import { List, ListItemText, ListItemButton, Box, IconButton, Tooltip, Typography, Divider } from '@mui/material';
import { Unarchive, DeleteForever } from '@mui/icons-material';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { useDialogStore } from '@/store/dialogStore';
import { useAppStateStore } from '@/store/appStateStore';
import * as idbService from '@/services/indexedDbService';

export const ArchiveList = () => {
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const isAccordionExpanded = useAppStateStore((state) => state.isAccordionExpanded);
  const setIsFocusedTreeName = useAppStateStore((state) => state.setIsFocusedTreeName);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setIsShowArchive = useAppStateStore((state) => state.setIsShowArchive);
  const showDialog = useDialogStore((state) => state.showDialog);

  const { handleChangeIsArchived, deleteTree } = useTreeManagement();
  const { loadAndSetCurrentTreeDataFromIdb } = useTreeManagement();

  const [timestamps, setTimestamps] = useState<Record<string, number>>({});

  const archivedTrees = treesList.filter((tree) => tree.isArchived);

  useEffect(() => {
    const ids = archivedTrees.map((t) => t.id);
    if (ids.length === 0) return;
    idbService.loadTreeTimestampsFromIdb(ids).then(setTimestamps);
  }, [treesList]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnArchiveClick = (treeId: UniqueIdentifier) => {
    handleChangeIsArchived(treeId, false);
  };

  const handleDeleteClick = async (treeId: UniqueIdentifier) => {
    const result = await showDialog(
      'すべての編集メンバーからツリーが削除されます。この操作は元に戻せません。実行しますか？',
      'Confirmation Required',
      true,
    );
    if (result) {
      await deleteTree(treeId);
    }
  };

  const handleListClick = async (treeId: UniqueIdentifier): Promise<void> => {
    if (currentTree === treeId) {
      return;
    }
    setCurrentTree(treeId);
    await loadAndSetCurrentTreeDataFromIdb(treeId);
    setIsShowArchive(false);
    if (isAccordionExpanded) {
      setTimeout(() => {
        setIsFocusedTreeName(true);
      }, 500);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: '900px',
        width: '100%',
        marginX: 'auto',
      }}
    >
      <Box sx={{ py: 4 }}>
        <Typography variant='h6' sx={{ textAlign: 'center' }}>
          アーカイブ済みツリー
        </Typography>
      </Box>
      <Box sx={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 2, p: 0, mb: 12 }}>
        <List
          sx={{
            m: 0,
            p: 0,
            textAlign: 'left',
          }}
        >
          {archivedTrees.map((tree, index) => (
            <React.Fragment key={tree.id}>
              <ListItemButton
                onClick={async () => await handleListClick(tree.id)}
                sx={{ width: '100%', height: 36, minHeight: 36, py: 0 }}
              >
                <ListItemText primary={tree.name} slotProps={{ primary: { variant: 'body2' } }} sx={{ my: 0 }} />
                {timestamps[String(tree.id)] && (
                  <Typography variant='caption' sx={{ color: 'text.secondary', flexShrink: 0, mx: 1 }}>
                    {new Date(timestamps[String(tree.id)]).toLocaleString('ja-JP', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                )}
                <Tooltip title='アーカイブ解除'>
                  <IconButton
                    size='small'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnArchiveClick(tree.id);
                    }}
                    sx={{ color: 'primary.main', flexShrink: 0 }}
                  >
                    <Unarchive sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title='削除'>
                  <IconButton
                    size='small'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(tree.id);
                    }}
                    sx={{ color: 'error.main', flexShrink: 0 }}
                  >
                    <DeleteForever sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
              {index !== archivedTrees.length - 1 && <Divider sx={{ width: '100%' }} />}
            </React.Fragment>
          ))}
          {archivedTrees.length === 0 && (
            <Typography sx={{ textAlign: 'center', my: 2, width: '100%' }}>アーカイブ済みのツリーはありません</Typography>
          )}
        </List>
      </Box>
    </Box>
  );
};
