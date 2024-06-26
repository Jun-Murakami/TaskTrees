import { useState, useRef, useEffect } from 'react';
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
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ImageIcon from '@mui/icons-material/Image';
import FolderIcon from '@mui/icons-material/Folder';
import { getDownloadURL, getStorage, ref } from 'firebase/storage';
import { useTheme } from '@mui/material/styles';
import { useTreeStateStore } from '../../store/treeStateStore';
import { useDialogStore } from '../../store/dialogStore';
import { useAttachedFile } from '../../hooks/useAttachedFile';
import { useAppStateStore } from '../../store/appStateStore';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';

interface MenuItemsProps {
  id: UniqueIdentifier;
  attachedFile?: string;
  currenTreeId: UniqueIdentifier | null;
  handleAttachFile?(id: UniqueIdentifier, fileName: string): void;
  onRemove?: () => void;
  onCopyItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): Promise<boolean>;
  onMoveItems?(targetTreeId: UniqueIdentifier, targetTaskId: UniqueIdentifier): Promise<void>;
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

const iconButtonStyle = {
  top: 0,
  width: { xs: '22px', sm: '30px' },
  minWidth: { xs: '22px', sm: '30px' },
  height: '30px',
  justifyContent: 'center',
  '& .MuiListItemIcon-root': {
    width: '30px',
    maxWidth: '30px',
    height: '30px',
    maxHeight: '30px',
  },
};

export function MenuItems({
  id,
  attachedFile,
  currenTreeId,
  handleAttachFile,
  onRemove,
  onCopyItems,
  onMoveItems,
}: MenuItemsProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);
  const [openCopyMenu, setOpenCopyMenu] = useState<boolean>(false);
  const [openMoveMenu, setOpenMoveMenu] = useState<boolean>(false);
  const [openIOSMenu, setOpenIOSMenu] = useState<boolean>(false);

  const showDialog = useDialogStore((state) => state.showDialog);

  const { uploadFile, deleteFile } = useAttachedFile();

  const anchorElParent = useRef<HTMLButtonElement>(null);
  const anchorElCopy = useRef<HTMLButtonElement>(null);
  const anchorElMove = useRef<HTMLButtonElement>(null);
  const anchorEliOS = useRef<HTMLButtonElement>(null);

  const isOffline = useAppStateStore((state) => state.isOffline);
  const currentTree = useTreeStateStore((state) => state.currentTree);
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
  const handleiOSClose = () => {
    setOpenIOSMenu(false);
  };

  // ファイルをアップロードして添付する処理
  const handleUploadClick = async () => {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      setOpenIOSMenu(!openIOSMenu);
    } else {
      //ファイルダイアログを開いてファイルを選択
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file || !currentTree) return;
        if (attachedFile) {
          const result = await showDialog(
            '既存の添付ファイルは上書きされます。新しいファイルを添付しますか？',
            'Information',
            true
          );
          if (!result) return;
          await deleteFile(attachedFile, currentTree, true);
        }

        //ファイルをアップロード
        const fileName = await uploadFile(file, currentTree);
        if (!fileName) return;
        //ファイルを添付
        handleAttachFile && handleAttachFile(id, fileName);
      };
      input.click();
      //DOMをクリーンナップ
      input.remove();
      handleParentClose();
    }
  };

  const handleiOSImagePicker = async () => {
    try {
      const result = await FilePicker.pickImages({
        multiple: false, // 複数選択を許可するかどうか
        readData: true, // Base64データを読み込む
      });
      if (result.files.length > 0) {
        const pickedFile = result.files[0];
        const base64Data = pickedFile.data; // Base64データを取得
        const fileName = pickedFile.name; // ファイル名を取得
        if (base64Data && fileName && currentTree) {
          // Base64文字列からBlobオブジェクトを生成
          const blob = new Blob([Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))], { type: pickedFile.mimeType });
          // BlobオブジェクトからFileオブジェクトを生成
          const file = new File([blob], fileName);
          const uploadedFileName = await uploadFile(file, currentTree);
          if (!uploadedFileName) return;
          // ファイルを添付
          handleAttachFile && handleAttachFile(id, uploadedFileName);
        }
      }
    } catch (error) {
      await showDialog('画像ファイルの選択に失敗しました。' + error, 'Error');
    }
  };

  const handleiOSFilePicker = async () => {
    try {
      const result = await FilePicker.pickFiles({
        multiple: false, // 複数選択を許可するかどうか
        readData: true, // Base64データを読み込む
      });
      if (result.files.length > 0) {
        const pickedFile = result.files[0];
        const base64Data = pickedFile.data; // Base64データを取得
        const fileName = pickedFile.name; // ファイル名を取得
        if (base64Data && fileName && currentTree) {
          // Base64文字列からBlobオブジェクトを生成
          const blob = new Blob([Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))], { type: pickedFile.mimeType });
          // BlobオブジェクトからFileオブジェクトを生成
          const file = new File([blob], fileName);
          const uploadedFileName = await uploadFile(file, currentTree);
          if (!uploadedFileName) return;
          // ファイルを添付
          handleAttachFile && handleAttachFile(id, uploadedFileName);
        }
      }
    } catch (error) {
      await showDialog('ファイルの選択に失敗しました。' + error, 'Error');
    }
  };

  return (
    <>
      <IconButton ref={anchorElParent} onClick={handleParentClick} sx={{ ...iconButtonStyle, color: theme.palette.grey[500] }}>
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
        {!isOffline && (
          <Box>
            <Divider />
            <Box ref={anchorEliOS}>
              <MenuItem
                onClick={async () => {
                  await handleUploadClick();
                }}
              >
                <ListItemIcon>
                  <AttachFileIcon fontSize='small' />
                </ListItemIcon>
                ファイルを添付
                <Menu
                  anchorEl={anchorEliOS.current}
                  id='menu-item-management-ios'
                  open={openIOSMenu}
                  onClose={() => {
                    handleiOSClose();
                    handleParentClose();
                  }}
                  sx={{
                    elevation: 0,
                  }}
                >
                  <MenuItem
                    onClick={async () => {
                      await handleiOSImagePicker();
                      handleParentClose();
                    }}
                  >
                    <ListItemIcon>
                      <ImageIcon fontSize='small' />
                    </ListItemIcon>
                    画像ファイルを添付
                  </MenuItem>
                  <MenuItem
                    onClick={async () => {
                      await handleiOSFilePicker();
                      handleParentClose();
                    }}
                  >
                    <ListItemIcon>
                      <FolderIcon fontSize='small' />
                    </ListItemIcon>
                    その他のファイルを添付
                  </MenuItem>
                </Menu>
              </MenuItem>
            </Box>
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
                      onClick={async () => {
                        onCopyItems && (await onCopyItems(tree.id, id));
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
                      onClick={async () => {
                        onMoveItems && (await onMoveItems(tree.id, id));
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
          </Box>
        )}
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
      <IconButton ref={anchorElParent} onClick={handleParentClick} sx={{ ...iconButtonStyle, color: theme.palette.grey[500] }}>
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
      <IconButton ref={anchorElParent} onClick={handleParentClick} sx={{ ...iconButtonStyle, color: theme.palette.grey[500] }}>
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
  const [imageURL, setImageURL] = useState<string | null>(null);

  const currentTree = useTreeStateStore((state) => state.currentTree);

  const { downloadFile, deleteFile } = useAttachedFile();

  const anchorElParent = useRef<HTMLButtonElement>(null);
  const prevAttachedFileRef = useRef<string | null>(null);

  const theme = useTheme();

  const handleParentClick = () => {
    setOpenParentMenu(!openParentMenu);
  };

  const handleParentClose = () => {
    setOpenParentMenu(false);
  };

  useEffect(() => {
    if (prevAttachedFileRef.current !== attachedFile) {
      if (attachedFile?.match(/\.(jpg|jpeg|png|gif|svg|webp|tif|tiff|bmp|ico|cur)$/i) && currentTree) {
        const storage = getStorage();
        const imageRef = ref(storage, `trees/${currentTree}/${attachedFile}`);
        getDownloadURL(imageRef)
          .then((url) => {
            setImageURL(url);
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        setImageURL(null);
      }
    }
    // 現在のattachedFileを記録
    prevAttachedFileRef.current = attachedFile;
  }, [attachedFile, currentTree]);

  return (
    <>
      {imageURL && (
        <Box
          sx={{
            width: '30px',
            minWidth: '30px',
            height: '30px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            backgroundColor: theme.palette.action.hover,
          }}
        >
          <Box
            component='img'
            sx={{
              height: 'auto',
              width: '100%',
            }}
            src={imageURL}
          />
        </Box>
      )}
      <IconButton ref={anchorElParent} onClick={handleParentClick} sx={{ ...iconButtonStyle, color: theme.palette.grey[500] }}>
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
        <MenuItem
          onClick={() => {
            downloadFile &&
              (async () => {
                if (!currentTree) return;
                await downloadFile(attachedFile, currentTree);
              })();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <InsertDriveFileOutlinedIcon fontSize='small' />
          </ListItemIcon>
          {attachedFile}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            deleteFile &&
              (async () => {
                if (!currentTree) return;
                await deleteFile(attachedFile, currentTree);
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
