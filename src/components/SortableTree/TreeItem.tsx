import { forwardRef, HTMLAttributes, useState, useRef, useCallback, memo } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery, ListItem, Stack, Badge, TextField, Checkbox, Button, Typography, IconButton } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import { useAttachedFile } from '../../hooks/useAttachedFile';
import { useTreeStackStyles } from '../../hooks/useTreeStackStyles';
import { useAppStateStore } from '../../store/appStateStore';
import { useTreeStateStore } from '../../store/treeStateStore';
import { MenuItems, MenuItemsTrash, MenuItemsTrashRoot, MenuItemsAttachedFile, MenuItemsTimer } from './MenuItems';

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
  indentationWidth: number;
  onCollapse?(): void;
  onRemove?(): void;
  wrapperRef?(node: HTMLLIElement): void;
  onChange?(value: string): void;
  onChangeDone?(done: boolean): void;
  onCopyItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): Promise<boolean>;
  onMoveItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): Promise<void>;
  onRestoreItems?(id: UniqueIdentifier): void;
  handleAttachFile(id: UniqueIdentifier, fileName: string): void;
  removeTrashDescendants?: () => Promise<void>;
  removeTrashDescendantsWithDone?: () => Promise<void>;
  isNewTask?: boolean;
  isItemDescendantOfTrash?: boolean;
}

export interface TreeItemContentProps extends TreeItemProps {
  currentTree: UniqueIdentifier | null;
  darkMode: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;
  isFocusedOrHovered: boolean;
  setIsFocusedOrHovered: (isFocusedOrHovered: boolean) => void;
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
    currentTree,
    darkMode,
    handleProps,
    indentationWidth,
    inputRef,
    isDragOver,
    isFocusedOrHovered,
    setIsFocusedOrHovered,
    onCollapse,
    onRemove,
    onChange,
    onChangeDone,
    onCopyItems,
    onMoveItems,
    onRestoreItems,
    handleAttachFile,
    removeTrashDescendants,
    removeTrashDescendantsWithDone,
    isItemDescendantOfTrash,
  }: TreeItemContentProps) => {
    const [isEditingTextLocal, setIsEditingTextLocal] = useState(false);
    const setIsEditingText = useAppStateStore((state) => state.setIsEditingText);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
            <DragHandleIcon />
          </Button>
        ) : (
          <Button sx={{ color: theme.palette.text.secondary, ...buttonStyle }}>
            <DeleteIcon />
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
              sx={{ ...buttonStyle, color: darkMode ? theme.palette.grey[400] : theme.palette.grey[600] }}
              checked={done}
              onChange={(e) => onChangeDone?.(e.target.checked)}
            />
            <TextField
              inputRef={inputRef}
              variant='standard'
              value={value}
              onChange={(e) => {
                onChange?.(e.target.value);
              }}
              multiline
              fullWidth
              sx={{ padding: 0, margin: 'auto 0', marginX: { xs: 0.75, sm: 1 } }}
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
              onFocus={() => {
                setIsEditingText(true);
                setIsEditingTextLocal(true);
                setIsFocusedOrHovered(true);
              }}
              onBlur={() => {
                setIsEditingText(false);
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
                <AttachFileIcon />
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
                <SaveAsIcon />
              </IconButton>
            ) : !clone && onRemove && !isItemDescendantOfTrash ? (
              <MenuItems
                key={`menu-${id}-${done}-${timer}-${isUpLift}-${upLiftMinute}`}
                onRemove={onRemove}
                handleAttachFile={handleAttachFile}
                onCopyItems={onCopyItems}
                onMoveItems={onMoveItems}
                currenTreeId={currentTree}
                id={id}
                attachedFile={attachedFile}
                timerDef={timer}
                isUpLiftDef={isUpLift}
                upLiftMinuteDef={upLiftMinute}
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
      prevProps.currentTree === nextProps.currentTree &&
      prevProps.darkMode === nextProps.darkMode &&
      prevProps.inputRef === nextProps.inputRef &&
      prevProps.isDragOver === nextProps.isDragOver &&
      prevProps.isFocusedOrHovered === nextProps.isFocusedOrHovered &&
      prevProps.onCollapse === nextProps.onCollapse &&
      prevProps.onRemove === nextProps.onRemove &&
      prevProps.onChange === nextProps.onChange &&
      prevProps.onChangeDone === nextProps.onChangeDone &&
      prevProps.onCopyItems === nextProps.onCopyItems &&
      prevProps.onMoveItems === nextProps.onMoveItems &&
      prevProps.onRestoreItems === nextProps.onRestoreItems &&
      prevProps.handleAttachFile === nextProps.handleAttachFile &&
      prevProps.removeTrashDescendants === nextProps.removeTrashDescendants &&
      prevProps.removeTrashDescendantsWithDone === nextProps.removeTrashDescendantsWithDone &&
      prevProps.depth === nextProps.depth &&
      prevProps.disableInteraction === nextProps.disableInteraction &&
      prevProps.disableSelection === nextProps.disableSelection &&
      prevProps.ghost === nextProps.ghost &&
      prevProps.handleProps === nextProps.handleProps &&
      prevProps.indicator === nextProps.indicator &&
      prevProps.indentationWidth === nextProps.indentationWidth &&
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
      isNewTask,
      isItemDescendantOfTrash,
      ...props
    },
    ref
  ) => {
    const currentTree = useTreeStateStore((state) => state.currentTree);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isFocusedOrHovered, setIsFocusedOrHovered] = useState(false);

    const darkMode = useAppStateStore((state) => state.darkMode);

    const stackStyles = useTreeStackStyles(clone, ghost, depth, isDragOver, darkMode, isNewTask);
    const { uploadFile } = useAttachedFile();

    const inputRef = useRef<HTMLInputElement>(null);

    const onDrop = useCallback(
      async (event: React.DragEvent<HTMLDivElement>) => {
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
      [uploadFile, handleAttachFile, id, currentTree]
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
            currentTree={currentTree}
            darkMode={darkMode}
            handleProps={handleProps}
            indentationWidth={indentationWidth}
            inputRef={inputRef}
            isDragOver={isDragOver}
            isFocusedOrHovered={isFocusedOrHovered}
            setIsFocusedOrHovered={setIsFocusedOrHovered}
            setIsDragOver={setIsDragOver}
            onCollapse={onCollapse}
            onRemove={onRemove}
            onChange={onChange}
            onChangeDone={onChangeDone}
            onCopyItems={onCopyItems}
            onMoveItems={onMoveItems}
            onRestoreItems={onRestoreItems}
            handleAttachFile={handleAttachFile}
            removeTrashDescendants={removeTrashDescendants}
            removeTrashDescendantsWithDone={removeTrashDescendantsWithDone}
            isItemDescendantOfTrash={isItemDescendantOfTrash}
          />
        </Stack>
      </ListItem>
    );
  }
);
