import { forwardRef, HTMLAttributes, useState, useEffect } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { isDescendantOfTrash } from './utilities';
import { useTheme } from '@mui/material/styles';
import { ListItem, Stack, Badge, TextField, Checkbox, Button, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppStateStore } from '../../store/appStateStore';
import { useTreeStateStore } from '../../store/treeStateStore';
import { MenuItems, MenuItemsTrash } from './MenuItems';

export interface TreeItemProps extends Omit<HTMLAttributes<HTMLLIElement>, 'id' | 'onChange' | 'onSelect'> {
  id: UniqueIdentifier;
  childCount?: number;
  clone?: boolean;
  collapsed?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  handleProps?: {
    [key: string]: unknown;
  };
  indicator?: boolean;
  indentationWidth: number;
  value: string;
  onCollapse?(): void;
  onRemove?(): void;
  wrapperRef?(node: HTMLLIElement): void;
  onChange?(value: string): void;
  onChangeDone?(done: boolean): void;
  done?: boolean;
  onCopyItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): void;
  onMoveItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): void;
  onRestoreItems?(id: UniqueIdentifier): void;
  onSelect?: (id: UniqueIdentifier) => void;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  (
    {
      id,
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      handleProps,
      indentationWidth,
      indicator,
      collapsed,
      onCollapse,
      onRemove,
      style,
      value,
      wrapperRef,
      onChange,
      done,
      onChangeDone,
      onCopyItems,
      onMoveItems,
      onRestoreItems,
      onSelect,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const items = useTreeStateStore((state) => state.items);
    const currentTree = useTreeStateStore((state) => state.currentTree);
    const [isFocusedOrHovered, setIsFocusedOrHovered] = useState(false);

    const darkMode = useAppStateStore((state) => state.darkMode);

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
      backgroundColor: darkMode
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
      ...(ghost && {
        zIndex: -1,
        position: 'relative',
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
        <Stack direction='row' ref={ref} style={style} sx={stackStyles(clone, ghost)}>
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
              {!clone && onRemove && !isDescendantOfTrash(items, id) ? (
                <MenuItems
                  onRemove={onRemove}
                  onCopyItems={onCopyItems}
                  onMoveItems={onMoveItems}
                  currenTreeId={currentTree}
                  id={id}
                />
              ) : (
                <MenuItemsTrash onRemove={onRemove} onRestoreItems={onRestoreItems} id={id} />
              )}
            </>
          ) : (
            <Typography sx={{ py: '5px', fontSize: '0.9rem', margin: 'auto 5px' }}> ゴミ箱 </Typography>
          )}
          {clone && childCount && childCount > 1 ? <Badge badgeContent={childCount} color='primary' /> : null}
        </Stack>
      </ListItem>
    );
  }
);
