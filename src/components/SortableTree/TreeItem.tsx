import { forwardRef, HTMLAttributes, useState, useEffect, useRef, useCallback } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { isDescendantOfTrash } from './utilities';
import { useTheme } from '@mui/material/styles';
import { ListItem, Stack, Badge, TextField, Checkbox, Button, Typography, IconButton } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { useAttachedFile } from '../../hooks/useAttachedFile';
import { useAppStateStore } from '../../store/appStateStore';
import { useTreeStateStore } from '../../store/treeStateStore';
import { MenuItems, MenuItemsTrash, MenuItemsTrashRoot, MenuItemsAttachedFile } from './MenuItems';

export interface TreeItemProps extends Omit<HTMLAttributes<HTMLLIElement>, 'id' | 'onChange' | 'onSelect'> {
  id: UniqueIdentifier;
  value: string;
  collapsed?: boolean;
  done?: boolean;
  attachedFile?: string;
  childCount?: number;
  clone?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  handleProps?: {
    [key: string]: unknown;
  };
  indicator?: boolean;
  indentationWidth: number;
  onCollapse?(): void;
  onRemove?(): void;
  wrapperRef?(node: HTMLLIElement): void;
  onChange?(value: string): void;
  onChangeDone?(done: boolean): void;
  onCopyItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): void;
  onMoveItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): void;
  onRestoreItems?(id: UniqueIdentifier): void;
  handleAttachFile(id: UniqueIdentifier, fileName: string): void;
  removeTrashDescendants?: () => Promise<void>;
  removeTrashDescendantsWithDone?: () => Promise<void>;
  onSelect?: (id: UniqueIdentifier) => void;
  isNewTask?: boolean;
  addedTaskId?: UniqueIdentifier | null;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  (
    {
      id,
      value,
      done,
      collapsed,
      attachedFile,
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      handleProps,
      indentationWidth,
      indicator,
      onCollapse,
      onRemove,
      style,
      wrapperRef,
      onChange,
      onChangeDone,
      onCopyItems,
      onMoveItems,
      onRestoreItems,
      handleAttachFile,
      removeTrashDescendants,
      removeTrashDescendantsWithDone,
      onSelect,
      isNewTask,
      addedTaskId,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const items = useTreeStateStore((state) => state.items);
    const currentTree = useTreeStateStore((state) => state.currentTree);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isFocusedOrHovered, setIsFocusedOrHovered] = useState(false);

    const { uploadFile } = useAttachedFile();

    const darkMode = useAppStateStore((state) => state.darkMode);

    const inputRef = useRef<HTMLInputElement>(null);

    const onDrop = useCallback(
      async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const files = Array.from(event.dataTransfer.files);
          const fileName = await uploadFile(files[0]);
          if (fileName) {
            handleAttachFile(id, fileName);
          }
          event.dataTransfer.clearData();
        }
      },
      [uploadFile, handleAttachFile, id]
    );

    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      // ドラッグ中の要素がドロップ可能であることを示す
      event.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }, []);

    const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
    }, []);

    useEffect(() => {
      if (addedTaskId === id && inputRef.current) {
        const timer = setTimeout(() => inputRef.current?.focus(), 500);
        return () => clearTimeout(timer);
      }
      return () => {};
    }, [addedTaskId, id]);

    useEffect(() => {
      const timer = setTimeout(() => setIsFocusedOrHovered(false), 300);
      return () => clearTimeout(timer);
    }, []);

    // ボタンの共通スタイルを定義
    const buttonStyle = {
      width: '30px',
      minWidth: '30px',
      height: '30px',
      marginTop: '0px',
    };

    const stackStyles = (clone: boolean | undefined, ghost: boolean | undefined) => ({
      width: '100%',
      p: 1,
      border: '1px solid',
      backgroundColor: isDragOver
        ? theme.palette.action.focus
        : darkMode
        ? depth >= 4
          ? theme.palette.grey[800]
          : depth === 3
          ? '#303030'
          : depth === 2
          ? theme.palette.grey[900]
          : depth === 1
          ? '#1a1a1a'
          : theme.palette.background.default
        : depth >= 4
        ? theme.palette.grey[300]
        : depth === 3
        ? theme.palette.grey[200]
        : depth === 2
        ? theme.palette.grey[100]
        : depth === 1
        ? theme.palette.grey[50]
        : theme.palette.background.default,
      borderColor: theme.palette.divider,
      boxSizing: 'border-box',
      ...(clone && {
        zIndex: 1000,
        opacity: 0.9,
        position: 'absolute',
        width: '250px',
        boxShadow: '0px 15px 15px 0 rgba(34, 33, 81, 0.1)',
        '& textarea': {
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        },
      }),
      ...(clone &&
        isNewTask && {
          left: '50%',
          transform: 'translateX(calc(-50% +125px))',
        }),
      ...(ghost && {
        zIndex: -1,
        padding: 0,
        height: '8px',
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.main,
        '&:before': {
          zIndex: -1,
          position: 'absolute',
          left: '-8px',
          top: '-4px',
          display: 'block',
          content: '""',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          border: '1px solid',
          borderColor: theme.palette.primary.main,
          backgroundColor: theme.palette.background.default,
        },
        '> *': {
          opacity: 0,
          height: 0,
        },
      }),
    });

    return (
      <ListItem
        ref={wrapperRef}
        sx={{
          p: 0,
          paddingLeft: `${depth * indentationWidth}px`,
          boxSizing: 'border-box',
          marginBottom: '-1px',
          ...(indicator && {
            opacity: 1,
            position: 'relative',
            zIndex: 1,
            marginBottom: '-1px',
          }),
          ...(disableSelection && {
            userSelect: 'none',
            WebkitUserSelect: 'none', // Safari/Chrome用
          }),
          ...(disableInteraction && {
            pointerEvents: 'none',
          }),
          ...(id === 'trash' && {
            marginTop: '20px',
          }),
        }}
        {...props}
      >
        <Stack
          direction='row'
          ref={ref}
          style={style}
          sx={stackStyles(clone, ghost)}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          {id !== 'trash' ? (
            <Button
              sx={{
                color: theme.palette.grey[500],
                cursor: 'grab',
                ...buttonStyle,
                touchAction: 'none',
              }}
              onClick={() => id !== undefined && onSelect?.(id)}
              {...handleProps}
            >
              <DragHandleIcon />
            </Button>
          ) : (
            <Button
              sx={{ color: theme.palette.text.secondary, ...buttonStyle }}
              onClick={() => id !== undefined && onSelect?.(id)}
            >
              <DeleteIcon />
            </Button>
          )}
          {onCollapse && (
            <Button
              sx={{
                color: theme.palette.grey[500],
                ...buttonStyle,
              }}
              onClick={() => {
                onCollapse?.();
                id !== undefined && onSelect?.(id);
              }}
            >
              <KeyboardArrowDownIcon
                sx={{
                  transition: 'transform 250ms ease',
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
              />
            </Button>
          )}
          {id !== 'trash' ? (
            <>
              <Checkbox
                sx={{ ...buttonStyle }}
                checked={done}
                onClick={() => id !== undefined && onSelect?.(id)}
                onChange={(e) => onChangeDone?.(e.target.checked)}
              />
              <TextField
                inputRef={inputRef}
                variant='standard'
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onClick={() => id !== undefined && onSelect?.(id)}
                multiline
                fullWidth
                sx={{ padding: 0, margin: 'auto 0', marginX: 1 }}
                InputProps={{
                  disableUnderline: !isFocusedOrHovered,
                  style: {
                    padding: 0,
                    margin: 0,
                    paddingTop: '3px',
                    paddingBottom: '3px',
                    fontSize: '0.9rem',
                  },
                }}
                onFocus={() => setIsFocusedOrHovered(true)}
                onBlur={() => {
                  setTimeout(() => setIsFocusedOrHovered(false), 300);
                }}
              />
              {!clone && isDragOver && (
                <IconButton
                  sx={{
                    color: theme.palette.grey[500],
                    ...buttonStyle,
                  }}
                >
                  <AttachFileIcon />
                </IconButton>
              )}
              {!clone && attachedFile && <MenuItemsAttachedFile attachedFile={attachedFile} />}
              {!clone && onRemove && !isDescendantOfTrash(items, id) ? (
                <MenuItems
                  onRemove={onRemove}
                  handleAttachFile={handleAttachFile}
                  onCopyItems={onCopyItems}
                  onMoveItems={onMoveItems}
                  currenTreeId={currentTree}
                  id={id}
                  attachedFile={attachedFile}
                />
              ) : (
                <MenuItemsTrash onRemove={onRemove} onRestoreItems={onRestoreItems} id={id} />
              )}
            </>
          ) : (
            <>
              <Typography sx={{ py: '5px', fontSize: '0.9rem', margin: 'auto 5px', width: '100%' }}> ゴミ箱 </Typography>
              {!clone && id === 'trash' && removeTrashDescendants && (
                <MenuItemsTrashRoot
                  removeTrashDescendants={removeTrashDescendants}
                  removeTrashDescendantsWithDone={removeTrashDescendantsWithDone}
                />
              )}
            </>
          )}
          {clone && childCount && childCount > 1 ? <Badge badgeContent={childCount} color='primary' /> : null}
        </Stack>
      </ListItem>
    );
  }
);
