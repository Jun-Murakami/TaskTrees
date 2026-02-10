import { FC, useState, useRef, useCallback, useEffect } from 'react';
import { DraggableAttributes, DraggableSyntheticListeners, UniqueIdentifier } from '@dnd-kit/core';
import {
  ListItemText,
  ListItemButton,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Tooltip,
  Paper,
  Typography,
  Popper,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DragHandle, Archive, MoreHoriz, DeleteForever, Unarchive } from '@mui/icons-material';
import { TreesListItem, TreeItem } from '@/types/types';
import { useTreeStateStore } from '@/store/treeStateStore';
import { indexedDb as idb } from '@/indexedDb';

export function flattenTreeToLines(items: TreeItem[], depth = 0, maxLines = 10): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (lines.length >= maxLines) break;
    if (item.id === 'trash') continue;
    const indent = '  '.repeat(depth);
    const doneMarker = item.done ? '✓ ' : '';
    lines.push(`${indent}${doneMarker}${item.value}`);
    if (item.children && item.children.length > 0 && lines.length < maxLines) {
      const childLines = flattenTreeToLines(item.children, depth + 1, maxLines - lines.length);
      lines.push(...childLines);
    }
  }
  return lines.slice(0, maxLines);
}

export type SortableSourceProps = {
  item: TreesListItem;
  handlerProps?: {
    ref: (element: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
  handleListClick: (treeId: UniqueIdentifier) => Promise<void>;
  setDrawerState: React.Dispatch<React.SetStateAction<boolean>>;
  onArchive?: (treeId: UniqueIdentifier, isArchived: boolean) => Promise<void>;
  onDelete?: (treeId: UniqueIdentifier) => Promise<void>;
};

export const SortableSource: FC<SortableSourceProps> = ({ item, handlerProps, handleListClick, setDrawerState, onArchive, onDelete }) => {
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [popperAnchor, setPopperAnchor] = useState<{ getBoundingClientRect: () => DOMRect } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listItemRef = useRef<HTMLDivElement>(null);

  const handleListItemButtonClick = async () => {
    await handleListClick(item.id);
    setDrawerState(false);
  };
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isMobile) return;
      const mouseY = e.clientY;
      const drawerEl = listItemRef.current?.closest('.MuiDrawer-paper');
      const drawerRight = drawerEl ? drawerEl.getBoundingClientRect().right : 300;

      setPopperAnchor({
        getBoundingClientRect: () => new DOMRect(drawerRight + 4, mouseY - 10, 0, 0),
      });

      hoverTimerRef.current = setTimeout(async () => {
        try {
          const treeData = await idb.treestate.get(item.id);
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
    [isMobile, item.id]
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
        ref={listItemRef}
        selected={currentTree === item.id}
        onClick={async () => {
          await handleListItemButtonClick();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          opacity: 1,
          height: 44,
          minHeight: 44,
          py: 0,
          pr: 0.5,
          '& .action-buttons': {
            opacity: isMobile ? 0.6 : 0,
          },
          '&:hover .action-buttons': {
            opacity: 0.6,
          },
        }}
      >
        <Button
          ref={handlerProps?.ref}
          sx={{
            cursor: handlerProps ? 'grab' : 'grabbing',
            color: theme.palette.grey[500],
            width: '20px',
            minWidth: '20px',
            height: '20px',
            mr: '10px',
            touchAction: 'none',
            zIndex: 1500,
          }}
          {...handlerProps?.attributes}
          {...handlerProps?.listeners}
        >
          <DragHandle />
        </Button>
        <ListItemText secondary={item.name} sx={{ mr: 0.5 }} />
        {item.isArchived && <Archive sx={{ color: theme.palette.grey[500], fontSize: 18, flexShrink: 0, mr: 0.5 }} />}
        {(onArchive || onDelete) && isMobile && (
          <>
            <IconButton
              className='action-buttons'
              size='small'
              onClick={handleMenuOpen}
              sx={{
                flexShrink: 0,
                width: 28,
                height: 28,
                color: theme.palette.text.secondary,
                transition: 'opacity 0.15s',
              }}
            >
              <MoreHoriz sx={{ fontSize: 18 }} />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              onClick={(e) => e.stopPropagation()}
              slotProps={{ paper: { sx: { minWidth: 160 } } }}
            >
              {onArchive && (
                <MenuItem
                  onClick={async () => {
                    handleMenuClose();
                    await onArchive(item.id, !item.isArchived);
                  }}
                >
                  <ListItemIcon>
                    {item.isArchived ? <Unarchive fontSize='small' /> : <Archive fontSize='small' />}
                  </ListItemIcon>
                  {item.isArchived ? '戻す' : 'アーカイブ'}
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem
                  onClick={async () => {
                    handleMenuClose();
                    await onDelete(item.id);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon>
                    <DeleteForever fontSize='small' color='error' />
                  </ListItemIcon>
                  削除
                </MenuItem>
              )}
            </Menu>
          </>
        )}
        {(onArchive || onDelete) && !isMobile && (
          <span className='action-buttons' style={{ display: 'flex', flexShrink: 0, transition: 'opacity 0.15s' }}>
            {onArchive && (
              <Tooltip title={item.isArchived ? '戻す' : 'アーカイブ'} placement='top' arrow>
                <IconButton
                  size='small'
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onArchive(item.id, !item.isArchived);
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    color: theme.palette.text.secondary,
                  }}
                >
                  {item.isArchived ? <Unarchive sx={{ fontSize: 18 }} /> : <Archive sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title='削除' placement='top' arrow>
                <IconButton
                  size='small'
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onDelete(item.id);
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    color: theme.palette.error.main,
                  }}
                >
                  <DeleteForever sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </span>
        )}
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
