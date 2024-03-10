import { useState, useRef } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import { IconButton, Menu, MenuItem, Divider, Box } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ListItemIcon from '@mui/material/ListItemIcon';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import UndoIcon from '@mui/icons-material/Undo';
import FlakyIcon from '@mui/icons-material/Flaky';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useTheme } from '@mui/material/styles';
import { useTreeStateStore } from '../../store/treeStateStore';
import { useAttachedFile } from '../../hooks/useAttachedFile';

interface MenuItemsProps {
  id: UniqueIdentifier;
  attachedFile?: string;
  currenTreeId: UniqueIdentifier | null;
  handleAttachFile?(id: UniqueIdentifier, fileName: string): void;
  onRemove?: () => void;
  onCopyItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): void;
  onMoveItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): void;
}

interface MenuItemsTrashProps {
  id: UniqueIdentifier;
  attachedFile?: string;
  onRemove?: () => void;
  onRestoreItems?(id: UniqueIdentifier): void;
}

interface MenuItemsTrashRootProps {
  removeTrashDescendants: () => Promise<void>;
  removeTrashDescendantsWithDone?: () => Promise<void>;
}

interface MenuItemsAttachedFileProps {
  attachedFile: string;
}

export function MenuItems({ id, currenTreeId, handleAttachFile, onRemove, onCopyItems, onMoveItems }: MenuItemsProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);
  const [openCopyMenu, setOpenCopyMenu] = useState<boolean>(false);
  const [openMoveMenu, setOpenMoveMenu] = useState<boolean>(false);

  const { uploadFile } = useAttachedFile();

  const anchorElParent = useRef<HTMLButtonElement>(null);
  const anchorElCopy = useRef<HTMLButtonElement>(null);
  const anchorElMove = useRef<HTMLButtonElement>(null);

  const treesList = useTreeStateStore((state) => state.treesList);
  const treesListWithoutId = treesList.filter((tree) => tree.id !== currenTreeId);

  const theme = useTheme();

  const handleParentClick = () => {
    setOpenParentMenu(!openParentMenu);
  };
  const handleCopyClick = () => {
    setOpenCopyMenu(!openCopyMenu);
  };
  const handleMoveClick = () => {
    setOpenMoveMenu(!openMoveMenu);
  };

  const handleParentClose = () => {
    setOpenParentMenu(false);
  };
  const handleCopyClose = () => {
    setOpenCopyMenu(false);
  };
  const handleMoveClose = () => {
    setOpenMoveMenu(false);
  };

  // ファイルをアップロードして添付する処理
  const handleUploadClick = () => {
    //ファイルダイアログを開いてファイルを選択
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      //ファイルをアップロード
      const fileName = await uploadFile(file);
      if (!fileName) return;
      //ファイルを添付
      handleAttachFile && handleAttachFile(id, fileName);
    };
    input.click();
    //DOMをクリーンナップ
    input.remove();
  };

  return (
    <>
      <IconButton
        ref={anchorElParent}
        onClick={handleParentClick}
        sx={{
          color: theme.palette.grey[500],
          top: 0,
          width: '30px',
          maxWidth: '30px',
          height: '30px',
          maxHeight: '30px',
          justifyContent: 'center',
          '& .MuiListItemIcon-root': {
            width: '30px',
            maxWidth: '30px',
            height: '30px',
            maxHeight: '30px',
          },
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorElParent.current}
        id='menu-item-management-parent'
        open={openParentMenu}
        onClose={handleParentClose}
        sx={{
          elevation: 0,
        }}
      >
        <MenuItem
          onClick={() => {
            onRemove && onRemove();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize='small' />
          </ListItemIcon>
          削除
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleUploadClick();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <AttachFileIcon fontSize='small' />
          </ListItemIcon>
          ファイルを添付
        </MenuItem>
        <Divider />
        <Box ref={anchorElCopy}>
          <MenuItem
            onClick={() => {
              handleCopyClick();
            }}
          >
            <ListItemIcon>
              <KeyboardDoubleArrowRightIcon fontSize='small' />
            </ListItemIcon>
            コピー
            <Menu
              anchorEl={anchorElCopy.current}
              id='menu-item-management-copy'
              open={openCopyMenu}
              onClose={() => {
                handleCopyClose();
                handleParentClose();
              }}
              sx={{
                elevation: 0,
              }}
            >
              {treesList.map((tree) => (
                <MenuItem
                  key={tree.id}
                  onClick={() => {
                    onCopyItems && onCopyItems(tree.id, id);
                    handleCopyClose();
                    handleParentClose();
                  }}
                >
                  <ListItemIcon>
                    <KeyboardDoubleArrowRightIcon fontSize='small' />
                  </ListItemIcon>
                  {tree.name}
                </MenuItem>
              ))}
            </Menu>
          </MenuItem>
        </Box>
        <Box ref={anchorElMove}>
          <MenuItem
            onClick={() => {
              handleMoveClick();
            }}
          >
            <ListItemIcon>
              <KeyboardArrowRightIcon fontSize='small' />
            </ListItemIcon>
            移動
            <Menu
              anchorEl={anchorElMove.current}
              id='menu-item-management-move'
              open={openMoveMenu}
              onClose={() => {
                handleMoveClose();
                handleParentClose();
              }}
              sx={{
                elevation: 0,
              }}
            >
              {treesListWithoutId.map((tree) => (
                <MenuItem
                  key={tree.id}
                  onClick={() => {
                    onMoveItems && onMoveItems(tree.id, id);
                    handleMoveClose();
                    handleParentClose();
                  }}
                >
                  <ListItemIcon>
                    <KeyboardArrowRightIcon fontSize='small' />
                  </ListItemIcon>
                  {tree.name}
                </MenuItem>
              ))}
            </Menu>
          </MenuItem>
        </Box>
      </Menu>
    </>
  );
}

export function MenuItemsTrash({ id, onRemove, onRestoreItems }: MenuItemsTrashProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);

  const anchorElParent = useRef<HTMLButtonElement>(null);

  const theme = useTheme();

  const handleParentClick = () => {
    setOpenParentMenu(!openParentMenu);
  };

  const handleParentClose = () => {
    setOpenParentMenu(false);
  };

  return (
    <>
      <IconButton
        ref={anchorElParent}
        onClick={handleParentClick}
        sx={{
          color: theme.palette.grey[500],
          top: 0,
          width: '30px',
          maxWidth: '30px',
          height: '30px',
          maxHeight: '30px',
          justifyContent: 'center',
          '& .MuiListItemIcon-root': {
            width: '30px',
            maxWidth: '30px',
            height: '30px',
            maxHeight: '30px',
          },
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorElParent.current}
        id='menu-item-management-parent'
        open={openParentMenu}
        onClose={handleParentClose}
        sx={{
          elevation: 0,
        }}
      >
        <MenuItem
          onClick={() => {
            onRemove && onRemove();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteForeverIcon fontSize='small' />
          </ListItemIcon>
          完全に削除
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            onRestoreItems && onRestoreItems(id);
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <UndoIcon fontSize='small' />
          </ListItemIcon>
          ゴミ箱から戻す
        </MenuItem>
      </Menu>
    </>
  );
}

export function MenuItemsTrashRoot({ removeTrashDescendants, removeTrashDescendantsWithDone }: MenuItemsTrashRootProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);

  const anchorElParent = useRef<HTMLButtonElement>(null);

  const theme = useTheme();

  const handleParentClick = () => {
    setOpenParentMenu(!openParentMenu);
  };

  const handleParentClose = () => {
    setOpenParentMenu(false);
  };

  return (
    <>
      <IconButton
        ref={anchorElParent}
        onClick={handleParentClick}
        sx={{
          color: theme.palette.grey[500],
          top: 0,
          width: '30px',
          maxWidth: '30px',
          height: '30px',
          maxHeight: '30px',
          justifyContent: 'center',
          '& .MuiListItemIcon-root': {
            width: '30px',
            maxWidth: '30px',
            height: '30px',
            maxHeight: '30px',
          },
        }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorElParent.current}
        id='menu-item-management-parent'
        open={openParentMenu}
        onClose={handleParentClose}
        sx={{
          elevation: 0,
        }}
      >
        <MenuItem
          onClick={() => {
            removeTrashDescendants &&
              (async () => {
                await removeTrashDescendants();
              })();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteForeverIcon fontSize='small' />
          </ListItemIcon>
          ゴミ箱を空にする
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            removeTrashDescendantsWithDone &&
              (async () => {
                await removeTrashDescendantsWithDone();
              })();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <FlakyIcon fontSize='small' />
          </ListItemIcon>
          完了済みタスクを完全に削除
        </MenuItem>
      </Menu>
    </>
  );
}

export function MenuItemsAttachedFile({ attachedFile }: MenuItemsAttachedFileProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);

  const { downloadFile, deleteFile } = useAttachedFile();

  const anchorElParent = useRef<HTMLButtonElement>(null);

  const theme = useTheme();

  const handleParentClick = () => {
    setOpenParentMenu(!openParentMenu);
  };

  const handleParentClose = () => {
    setOpenParentMenu(false);
  };

  return (
    <>
      <IconButton
        ref={anchorElParent}
        onClick={handleParentClick}
        sx={{
          color: theme.palette.grey[500],
          top: 0,
          width: '30px',
          maxWidth: '30px',
          height: '30px',
          maxHeight: '30px',
          justifyContent: 'center',
          '& .MuiListItemIcon-root': {
            width: '30px',
            maxWidth: '30px',
            height: '30px',
            maxHeight: '30px',
          },
        }}
      >
        <AttachFileIcon />
      </IconButton>
      <Menu
        anchorEl={anchorElParent.current}
        id='menu-item-management-parent'
        open={openParentMenu}
        onClose={handleParentClose}
        sx={{
          elevation: 0,
        }}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <InsertDriveFileOutlinedIcon fontSize='small' />
          </ListItemIcon>
          {attachedFile}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            downloadFile &&
              (async () => {
                await downloadFile(attachedFile);
              })();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DownloadIcon fontSize='small' />
          </ListItemIcon>
          ダウンロード
        </MenuItem>
        <MenuItem
          onClick={() => {
            deleteFile &&
              (async () => {
                await deleteFile(attachedFile);
              })();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteForeverIcon fontSize='small' />
          </ListItemIcon>
          削除
        </MenuItem>
      </Menu>
    </>
  );
}
