import { forwardRef, HTMLAttributes, useState, useRef, useCallback, memo, useEffect } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery, ListItem, Stack, Badge, TextField, Checkbox, Button, Typography, IconButton } from '@mui/material';
import { KeyboardArrowDown, DragHandle, Delete, AttachFile, SaveAs } from '@mui/icons-material';
import { useTreeStackStyles } from '@/features/sortableTree/hooks/useTreeStackStyles';
import { useAttachedFile } from '@/features/sortableTree/hooks/useAttachedFile';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import {
  MenuItems,
  MenuItemsTrash,
  MenuItemsTrashRoot,
  MenuItemsAttachedFile,
  MenuItemsTimer,
} from '@/features/sortableTree/MenuItems';

export interface TreeItemProps extends Omit<HTMLAttributes<HTMLLIElement>, 'id' | 'onChange' | 'onSelect'> {
  id: UniqueIdentifier;
  value: string;
  collapsed?: boolean;
  done?: boolean;
  attachedFile?: string;
  timer?: string;
  isUpLift?: boolean;
  upLiftMinute?: number;
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
  onCollapse?(): void;
  wrapperRef?(node: HTMLLIElement): void;
  isNewTask?: boolean;
  isItemDescendantOfTrash?: boolean;
}

export interface TreeItemContentProps extends TreeItemProps {
  darkMode: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;
  isFocusedOrHovered: boolean;
  setIsFocusedOrHovered: (isFocusedOrHovered: boolean) => void;
  indentationWidth: number;
}

const TreeItemContent = memo(
  ({
    id,
    value,
    done,
    attachedFile,
    timer,
    isUpLift,
    upLiftMinute,
    childCount,
    clone,
    collapsed,
    darkMode,
    handleProps,
    inputRef,
    isDragOver,
    isFocusedOrHovered,
    setIsFocusedOrHovered,
    onCollapse,
    isItemDescendantOfTrash,
    indentationWidth,
  }: TreeItemContentProps) => {
    const [isEditingTextLocal, setIsEditingTextLocal] = useState(false);
    const [localText, setLocalText] = useState(value);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const { handleValueChange, handleDoneChange } = useTaskManagement();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalText(e.target.value);
      setTimeout(() => handleValueChange(id, e.target.value), 100);
    };

    useEffect(() => {
      setLocalText(value);
    }, [value]);

    // ボタンの共通スタイルを定義
    const buttonStyle = {
      width: `${indentationWidth}px`,
      minWidth: `${indentationWidth}px`,
      height: '30px',
      marginTop: '0px',
    };

    return (
      <>
        {id !== 'trash' ? (
          <Button
            sx={{
              color: theme.palette.grey[500],
              cursor: 'grab',
              ...buttonStyle,
              touchAction: 'none',
            }}
            {...handleProps}
          >
            <DragHandle />
          </Button>
        ) : (
          <Button sx={{ color: theme.palette.text.secondary, ...buttonStyle }}>
            <Delete />
          </Button>
        )}
        {onCollapse && (
          <Button
            sx={{
              ...buttonStyle,
              color: theme.palette.grey[500],
            }}
            onClick={() => {
              onCollapse?.();
            }}
          >
            <KeyboardArrowDown
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
              sx={{ ...buttonStyle, color: darkMode ? theme.palette.grey[400] : theme.palette.grey[600] }}
              checked={done}
              onChange={(e) => handleDoneChange(id, e.target.checked)}
            />
            <TextField
              inputRef={inputRef}
              variant='standard'
              value={localText}
              onChange={handleChange}
              multiline
              fullWidth
              sx={{ my: 0, mx: { xs: 0.75, sm: 1 } }}
              slotProps={{
                input: {
                  disableUnderline: !isFocusedOrHovered,
                  style: {
                    fontSize: '0.9rem',
                  },
                },
              }}
              onFocus={() => {
                setIsEditingTextLocal(true);
                setIsFocusedOrHovered(true);
              }}
              onBlur={() => {
                setIsEditingTextLocal(false);
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
                <AttachFile />
              </IconButton>
            )}
            {!clone && timer && (
              <MenuItemsTimer
                key={`timer-${id}-${done}-${timer}-${isUpLift}-${upLiftMinute}`}
                id={id}
                timerDef={timer}
                done={done}
                isUpLiftDef={isUpLift}
                upLiftMinuteDef={upLiftMinute}
              />
            )}
            {!clone && attachedFile && <MenuItemsAttachedFile attachedFile={attachedFile} />}
            {isEditingTextLocal && isMobile ? (
              <IconButton
                sx={{
                  color: theme.palette.grey[500],
                  ...buttonStyle,
                }}
              >
                <SaveAs />
              </IconButton>
            ) : !clone && !isItemDescendantOfTrash ? (
              <MenuItems
                key={`menu-${id}-${done}-${timer}-${isUpLift}-${upLiftMinute}`}
                id={id}
                attachedFile={attachedFile}
                timerDef={timer}
                isUpLiftDef={isUpLift}
                upLiftMinuteDef={upLiftMinute}
              />
            ) : (
              <MenuItemsTrash id={id} />
            )}
          </>
        ) : (
          <>
            <Typography sx={{ py: '5px', fontSize: '0.9rem', margin: 'auto 5px', width: '100%' }}> ゴミ箱 </Typography>
            {!clone && id === 'trash' && <MenuItemsTrashRoot />}
          </>
        )}
        {clone && childCount && childCount > 1 ? <Badge badgeContent={childCount} color='primary' /> : null}
      </>
    );
  },
  (prevProps, nextProps) => {
    // メモ化の条件を設定
    // propsの一部のみを比較するなど、必要に応じて最適化
    return (
      prevProps.value === nextProps.value &&
      prevProps.style === nextProps.style &&
      prevProps.done === nextProps.done &&
      prevProps.attachedFile === nextProps.attachedFile &&
      prevProps.timer === nextProps.timer &&
      prevProps.isUpLift === nextProps.isUpLift &&
      prevProps.upLiftMinute === nextProps.upLiftMinute &&
      prevProps.childCount === nextProps.childCount &&
      prevProps.clone === nextProps.clone &&
      prevProps.collapsed === nextProps.collapsed &&
      prevProps.darkMode === nextProps.darkMode &&
      prevProps.inputRef === nextProps.inputRef &&
      prevProps.isDragOver === nextProps.isDragOver &&
      prevProps.isFocusedOrHovered === nextProps.isFocusedOrHovered &&
      prevProps.onCollapse === nextProps.onCollapse &&
      prevProps.depth === nextProps.depth &&
      prevProps.disableInteraction === nextProps.disableInteraction &&
      prevProps.disableSelection === nextProps.disableSelection &&
      prevProps.ghost === nextProps.ghost &&
      prevProps.handleProps === nextProps.handleProps &&
      prevProps.indicator === nextProps.indicator &&
      prevProps.isNewTask === nextProps.isNewTask &&
      prevProps.isItemDescendantOfTrash === nextProps.isItemDescendantOfTrash
    );
  }
);

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  (
    {
      id,
      value,
      done,
      collapsed,
      attachedFile,
      timer,
      isUpLift,
      upLiftMinute,
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      handleProps,
      indicator,
      onCollapse,
      style,
      wrapperRef,
      isNewTask,
      isItemDescendantOfTrash,
      ...props
    },
    ref
  ) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isFocusedOrHovered, setIsFocusedOrHovered] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    let indentationWidth;
    if (isMobile) {
      indentationWidth = 22;
    } else {
      indentationWidth = 30;
    }

    const darkMode = useAppStateStore((state) => state.darkMode);

    const stackStyles = useTreeStackStyles(clone, ghost, depth, isDragOver, darkMode, isNewTask);
    const { handleAttachFile } = useTaskManagement();
    const { uploadFile } = useAttachedFile();

    const inputRef = useRef<HTMLInputElement>(null);

    const onDrop = useCallback(
      async (event: React.DragEvent<HTMLDivElement>) => {
        const currentTree = useTreeStateStore.getState().currentTree;
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0 && currentTree) {
          const files = Array.from(event.dataTransfer.files);
          const fileName = await uploadFile(files[0], currentTree);
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
          sx={stackStyles}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <TreeItemContent
            id={id}
            value={value}
            depth={depth}
            done={done}
            attachedFile={attachedFile}
            timer={timer}
            isUpLift={isUpLift}
            upLiftMinute={upLiftMinute}
            childCount={childCount}
            clone={clone}
            collapsed={collapsed}
            darkMode={darkMode}
            handleProps={handleProps}
            indentationWidth={indentationWidth}
            inputRef={inputRef}
            isDragOver={isDragOver}
            isFocusedOrHovered={isFocusedOrHovered}
            setIsFocusedOrHovered={setIsFocusedOrHovered}
            setIsDragOver={setIsDragOver}
            onCollapse={onCollapse}
            isItemDescendantOfTrash={isItemDescendantOfTrash}
          />
        </Stack>
      </ListItem>
    );
  }
);
