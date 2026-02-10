import React, { FC, useEffect, useState, useRef, useCallback } from 'react';
import { useTreeStateStore } from '@/store/treeStateStore';
import { UniqueIdentifier } from '@dnd-kit/core';
import { List, ListItemText, ListItemButton, Box, IconButton, Tooltip, Typography, Divider, Paper, Popper, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Unarchive, DeleteForever } from '@mui/icons-material';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { useDialogStore } from '@/store/dialogStore';
import { useAppStateStore } from '@/store/appStateStore';
import { TreesListItem } from '@/types/types';
import { indexedDb as idb } from '@/indexedDb';
import { flattenTreeToLines } from '@/features/sortableList/SortableSource';
import * as idbService from '@/services/indexedDbService';

type ArchiveListItemProps = {
  tree: TreesListItem;
  timestamp?: number;
  isMobile: boolean;
  onListClick: (treeId: UniqueIdentifier) => Promise<void>;
  onUnArchive: (treeId: UniqueIdentifier) => void;
  onDelete: (treeId: UniqueIdentifier) => Promise<void>;
};

const ArchiveListItem: FC<ArchiveListItemProps> = ({ tree, timestamp, isMobile, onListClick, onUnArchive, onDelete }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [popperAnchor, setPopperAnchor] = useState<{ getBoundingClientRect: () => DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isMobile) return;
      const mouseY = e.clientY;
      const itemEl = itemRef.current;
      const itemRight = itemEl ? itemEl.getBoundingClientRect().right : 500;

      setPopperAnchor({
        getBoundingClientRect: () => new DOMRect(itemRight + 8, mouseY - 10, 0, 0),
      });

      hoverTimerRef.current = setTimeout(async () => {
        try {
          const treeData = await idb.treestate.get(tree.id);
          if (treeData && treeData.items) {
            const lines = flattenTreeToLines(treeData.items, 0, 10);
            if (lines.length > 0) {
              setPreviewLines(lines);
              setPreviewOpen(true);
            }
          }
        } catch {
          /* empty */
        }
      }, 200);
    },
    [isMobile, tree.id]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setPreviewOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <ListItemButton
        ref={itemRef}
        onClick={async () => await onListClick(tree.id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ width: '100%', height: 36, minHeight: 36, py: 0 }}
      >
        <ListItemText primary={tree.name} slotProps={{ primary: { variant: 'body2' } }} sx={{ my: 0 }} />
        {timestamp && (
          <Typography variant='caption' sx={{ color: 'text.secondary', flexShrink: 0, mx: 1 }}>
            {new Date(timestamp).toLocaleString('ja-JP', {
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
              onUnArchive(tree.id);
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
              onDelete(tree.id);
            }}
            sx={{ color: 'error.main', flexShrink: 0 }}
          >
            <DeleteForever sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </ListItemButton>

      {!isMobile && (
        <Popper
          open={previewOpen}
          anchorEl={popperAnchor}
          placement='right-start'
          sx={{ zIndex: 1400, pointerEvents: 'none' }}
        >
          <Paper
            elevation={8}
            sx={{
              p: 1.5,
              maxWidth: 360,
              minWidth: 200,
              maxHeight: 280,
              overflow: 'hidden',
            }}
          >
            <Typography
              variant='caption'
              component='div'
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                whiteSpace: 'pre',
                color: theme.palette.text.secondary,
              }}
            >
              {previewLines.join('\n')}
            </Typography>
          </Paper>
        </Popper>
      )}
    </>
  );
};

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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
        maxWidth: { xs: '100%', sm: '500px' },
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
              <ArchiveListItem
                tree={tree}
                timestamp={timestamps[String(tree.id)]}
                isMobile={isMobile}
                onListClick={handleListClick}
                onUnArchive={handleUnArchiveClick}
                onDelete={handleDeleteClick}
              />
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
