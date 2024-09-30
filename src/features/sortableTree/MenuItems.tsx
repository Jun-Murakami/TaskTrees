import { useState, useRef, useEffect } from 'react';
import { UniqueIdentifier } from '@dnd-kit/core';
import dayjs, { Dayjs } from 'dayjs';
import {
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  TextField,
  Button,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import {
  MoreVert,
  KeyboardArrowRight,
  KeyboardDoubleArrowRight,
  Delete,
  DeleteForever,
  Undo,
  Flaky,
  AttachFile,
  InsertDriveFileOutlined,
  AccessAlarm,
  Image,
  Folder,
} from '@mui/icons-material';
import ListItemIcon from '@mui/material/ListItemIcon';
import { getDownloadURL, getStorage, ref } from 'firebase/storage';
import { useTheme } from '@mui/material/styles';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { useAttachedFile } from '@/features/sortableTree/hooks/useAttachedFile';
import { useAppStateStore } from '@/store/appStateStore';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';

interface MenuItemsProps {
  id: UniqueIdentifier;
  attachedFile?: string;
  timerDef?: string;
  isUpLiftDef?: boolean;
  upLiftMinuteDef?: number;
}

interface MenuItemsTrashProps {
  id: UniqueIdentifier;
  attachedFile?: string;
}

interface MenuItemsAttachedFileProps {
  attachedFile: string;
}

interface MenuItemsTimerProps {
  id: UniqueIdentifier;
  timerDef?: string;
  done?: boolean;
  isUpLiftDef?: boolean;
  upLiftMinuteDef?: number;
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

export function MenuItems({ id, attachedFile, timerDef, isUpLiftDef, upLiftMinuteDef }: MenuItemsProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);
  const [openCopyMenu, setOpenCopyMenu] = useState<boolean>(false);
  const [openMoveMenu, setOpenMoveMenu] = useState<boolean>(false);
  const [openIOSMenu, setOpenIOSMenu] = useState<boolean>(false);
  const [openTimerMenu, setOpenTimerMenu] = useState<boolean>(false);
  const [time, setTime] = useState<Dayjs | null>(null);
  const [isUpLift, setIsUpLift] = useState<boolean>(false);
  const [upLiftHour, setUpLiftHour] = useState<number | undefined>(undefined);
  const [upLiftMinute, setUpLiftMinute] = useState<number | undefined>(undefined);

  const { handleRemove, handleCopy, handleMove, handleAttachFile } = useTaskManagement();

  // const [isNotify, setIsNotify] = useState<boolean>(false);
  // const [notifyHour, setNotifyHour] = useState<number | undefined>(undefined);
  // const [notifyMinute, setNotifyMinute] = useState<number | undefined>(undefined);

  const anchorElParent = useRef<HTMLButtonElement>(null);
  const anchorElCopy = useRef<HTMLButtonElement>(null);
  const anchorElMove = useRef<HTMLButtonElement>(null);
  const anchorEliOS = useRef<HTMLButtonElement>(null);
  const anchorElTimer = useRef<HTMLButtonElement>(null);

  const isOffline = useAppStateStore((state) => state.isOffline);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const treesList = useTreeStateStore((state) => state.treesList);
  const treesListWithoutId = treesList.filter((tree) => tree.id !== currentTree);

  const theme = useTheme();

  const hours = [...Array(49).keys()];
  const minutes = [...Array(60).keys()];

  const showDialog = useDialogStore((state) => state.showDialog);

  const { uploadFile, deleteFile } = useAttachedFile();
  const { handleSetTimer } = useTaskManagement();

  const updateTimerValues = () => {
    setTime(timerDef ? dayjs(timerDef) : dayjs(Date.now()));
    setIsUpLift(isUpLiftDef || false);
    if (upLiftMinuteDef) {
      setUpLiftHour(Math.floor((upLiftMinuteDef - 1) / 60));
      setUpLiftMinute(upLiftMinuteDef % 60);
    } else {
      setUpLiftHour(undefined);
      setUpLiftMinute(undefined);
    }
  };

  const handleOpenTimerMenu = () => {
    updateTimerValues();
    setOpenTimerMenu(true);
  };

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
        if (handleAttachFile) {
          handleAttachFile(id, fileName);
        }
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
        limit: 1, // 複数選択を許可するかどうか
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
          if (handleAttachFile) {
            handleAttachFile(id, uploadedFileName);
          }
        }
      }
    } catch (error) {
      await showDialog('画像ファイルの選択に失敗しました。' + error, 'Error');
    }
  };

  const handleiOSFilePicker = async () => {
    try {
      const result = await FilePicker.pickFiles({
        limit: 1, // 複数選択を許可するかどうか
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
          if (handleAttachFile) {
            handleAttachFile(id, uploadedFileName);
          }
        }
      }
    } catch (error) {
      await showDialog('ファイルの選択に失敗しました。' + error, 'Error');
    }
  };

  return (
    <>
      <IconButton ref={anchorElParent} onClick={handleParentClick} sx={{ ...iconButtonStyle, color: theme.palette.grey[500] }}>
        <MoreVert />
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
          onClick={async () => {
            await handleRemove(id);
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <Delete fontSize='small' />
          </ListItemIcon>
          削除
        </MenuItem>
        {!isOffline && (
          <Box>
            <Divider />
            <Box ref={anchorElTimer}>
              <MenuItem
                disableRipple
                onClick={() => {
                  if (!openTimerMenu) {
                    handleOpenTimerMenu();
                  }
                }}
              >
                <ListItemIcon>
                  <AccessAlarm fontSize='small' />
                </ListItemIcon>
                タイマーをセット
                <Menu
                  anchorEl={anchorElTimer.current}
                  id='menu-item-management-timer'
                  open={openTimerMenu}
                  onClose={() => {
                    setOpenTimerMenu(false);
                    handleParentClose();
                  }}
                >
                  <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
                    <DateTimePicker
                      viewRenderers={{
                        hours: renderTimeViewClock,
                        minutes: renderTimeViewClock,
                        seconds: renderTimeViewClock,
                      }}
                      label='タイマー'
                      value={time}
                      onChange={(newValue) => {
                        setTime(newValue);
                      }}
                      sx={{ marginX: 'auto', my: 2 }}
                    />
                  </Box>
                  <Box sx={{ px: 2 }}>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <>
                            <Checkbox checked={isUpLift} onChange={(e) => setIsUpLift(e.target.checked)} />
                            <Autocomplete
                              freeSolo
                              options={hours}
                              renderInput={(params) => <TextField {...params} label='時間' size='small' />}
                              value={upLiftHour !== undefined ? upLiftHour : null}
                              onChange={(_, newValue) => {
                                const parsedValue = parseInt(newValue as string, 10);
                                if (!isNaN(parsedValue) && parsedValue >= 0) {
                                  setUpLiftHour(parsedValue);
                                } else {
                                  setUpLiftHour(undefined);
                                }
                              }}
                              onInputChange={(_, newInputValue) => {
                                const parsedValue = parseInt(newInputValue, 10);
                                if (!isNaN(parsedValue) && parsedValue >= 0) {
                                  setUpLiftHour(parsedValue);
                                } else {
                                  setUpLiftHour(undefined);
                                }
                              }}
                              sx={{ width: 100, mr: 1 }}
                              size='small'
                              getOptionLabel={(option) => (option !== null ? option.toString() : '')}
                            />
                            <Autocomplete
                              freeSolo
                              options={minutes}
                              renderInput={(params) => <TextField {...params} label='分' size='small' />}
                              value={upLiftMinute !== undefined ? upLiftMinute : null}
                              onChange={(_, newValue) => {
                                const parsedValue = parseInt(newValue as string, 10);
                                if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue < 60) {
                                  setUpLiftMinute(parsedValue);
                                } else {
                                  setUpLiftMinute(undefined);
                                }
                              }}
                              onInputChange={(_, newInputValue) => {
                                const parsedValue = parseInt(newInputValue, 10);
                                if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue < 60) {
                                  setUpLiftMinute(parsedValue);
                                } else {
                                  setUpLiftMinute(undefined);
                                }
                              }}
                              sx={{ width: 80, mr: 1 }}
                              size='small'
                              getOptionLabel={(option) => (option !== null ? option.toString() : '')}
                            />
                          </>
                        }
                        label='前に上へ移動'
                      />
                    </FormGroup>
                  </Box>
                  {/*
                  <MenuItem disableRipple>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <>
                            <Checkbox checked={isNotify} onChange={(e) => setIsNotify(e.target.checked)} />
                            <Autocomplete
                              freeSolo
                              options={hours}
                              renderInput={(params) => <TextField {...params} label='時間' size='small' />}
                              value={notifyHour}
                              onChange={(_, newValue) => {
                                const parsedValue = parseInt(newValue as string, 10);
                                if (!isNaN(parsedValue) && parsedValue >= 0) {
                                  setNotifyHour(parsedValue);
                                } else {
                                  setNotifyHour(undefined);
                                }
                              }}
                              sx={{ width: 100, mr: 1 }}
                              size='small'
                            />
                            <Autocomplete
                              freeSolo
                              options={minutes}
                              renderInput={(params) => <TextField {...params} label='分' size='small' />}
                              value={notifyMinute}
                              onChange={(_, newValue) => {
                                const parsedValue = parseInt(newValue as string, 10);
                                if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue < 60) {
                                  setNotifyMinute(parsedValue);
                                } else {
                                  setNotifyMinute(undefined);
                                }
                              }}
                              sx={{ width: 80, mr: 1 }}
                              size='small'
                            />
                          </>
                        }
                        label='前に通知'
                      />
                    </FormGroup>
                  </MenuItem>
                  */}
                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', my: 2 }}>
                    <Button
                      onClick={() => {
                        if (!time) return;
                        const uh = upLiftHour ? upLiftHour * 60 : 0;
                        const um = upLiftMinute ? upLiftMinute : 0;
                        const uhm = uh + um === 0 ? undefined : uh + um;
                        // const nh = notifyHour ? notifyHour * 60 : 0;
                        // const nm = notifyMinute ? notifyMinute : 0;
                        // const nhm = nh + nm === 0 ? undefined : nh + nm;
                        handleSetTimer(id, time.toISOString(), isUpLift, uhm, undefined, undefined);
                        setOpenTimerMenu(false);
                        handleParentClose();
                      }}
                      variant='contained'
                      color='primary'
                      sx={{ mr: 2 }}
                    >
                      セット
                    </Button>
                    <Button
                      onClick={() => {
                        handleSetTimer(id, undefined, undefined, undefined, undefined, undefined);
                        setOpenTimerMenu(false);
                        handleParentClose();
                      }}
                      variant='contained'
                      color='error'
                    >
                      解除
                    </Button>
                  </Box>
                </Menu>
              </MenuItem>
            </Box>
            <Divider />
            <Box ref={anchorEliOS}>
              <MenuItem
                onClick={async () => {
                  await handleUploadClick();
                }}
              >
                <ListItemIcon>
                  <AttachFile fontSize='small' />
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
                      <Image fontSize='small' />
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
                      <Folder fontSize='small' />
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
                  <KeyboardDoubleArrowRight fontSize='small' />
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
                        await handleCopy(tree.id, id);
                        handleCopyClose();
                        handleParentClose();
                      }}
                    >
                      <ListItemIcon>
                        <KeyboardDoubleArrowRight fontSize='small' />
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
                  <KeyboardArrowRight fontSize='small' />
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
                        await handleMove(tree.id, id);
                        handleMoveClose();
                        handleParentClose();
                      }}
                    >
                      <ListItemIcon>
                        <KeyboardArrowRight fontSize='small' />
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

export function MenuItemsTrash({ id }: MenuItemsTrashProps) {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);

  const { handleRemove, handleRestore } = useTaskManagement();

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
        <MoreVert />
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
          onClick={async () => {
            await handleRemove(id);
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteForever fontSize='small' />
          </ListItemIcon>
          完全に削除
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            await handleRestore(id);
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <Undo fontSize='small' />
          </ListItemIcon>
          ゴミ箱から戻す
        </MenuItem>
      </Menu>
    </>
  );
}

export function MenuItemsTrashRoot() {
  const [openParentMenu, setOpenParentMenu] = useState<boolean>(false);

  const { removeTrashDescendants, removeTrashDescendantsWithDone } = useTaskManagement();

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
        <MoreVert />
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
          onClick={async () => {
            await removeTrashDescendants();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteForever fontSize='small' />
          </ListItemIcon>
          ゴミ箱を空にする
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            await removeTrashDescendantsWithDone();
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <Flaky fontSize='small' />
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
        <AttachFile />
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
          onClick={async () => {
            if (downloadFile && currentTree) {
              await downloadFile(attachedFile, currentTree);
            }
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <InsertDriveFileOutlined fontSize='small' />
          </ListItemIcon>
          {attachedFile}
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            if (deleteFile && currentTree) {
              await deleteFile(attachedFile, currentTree);
            }
            handleParentClose();
          }}
        >
          <ListItemIcon>
            <DeleteForever fontSize='small' />
          </ListItemIcon>
          削除
        </MenuItem>
      </Menu>
    </>
  );
}

export function MenuItemsTimer({ id, timerDef, done, isUpLiftDef, upLiftMinuteDef }: MenuItemsTimerProps) {
  const [openTimerMenu, setOpenTimerMenu] = useState<boolean>(false);
  const [time, setTime] = useState<Dayjs | null>(timerDef ? dayjs(timerDef) : null);
  const [isUpLift, setIsUpLift] = useState<boolean>(isUpLiftDef || false);
  const [upLiftHour, setUpLiftHour] = useState<number | undefined>(
    upLiftMinuteDef ? Math.floor((upLiftMinuteDef - 1) / 60) : undefined
  );
  const [upLiftMinute, setUpLiftMinute] = useState<number | undefined>(upLiftMinuteDef ? upLiftMinuteDef % 60 : undefined);
  const [currentTime, setCurrentTime] = useState<Dayjs>(dayjs());

  const anchorElTimer = useRef<HTMLButtonElement>(null);

  const hours = [...Array(49).keys()];
  const minutes = [...Array(60).keys()];

  const { handleSetTimer } = useTaskManagement();

  const theme = useTheme();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000); // 1分ごとに更新

    return () => clearInterval(timer);
  }, []);

  if (!timerDef) return null;

  const upLiftTime = upLiftMinuteDef ? dayjs(timerDef).subtract(upLiftMinuteDef, 'minutes') : undefined;
  const timerColor = time
    ? done
      ? theme.palette.primary.main
      : currentTime.isAfter(time)
      ? theme.palette.error.main
      : upLiftTime && currentTime.isAfter(upLiftTime)
      ? theme.palette.warning.main
      : theme.palette.grey[500]
    : undefined;

  return (
    <>
      {time && (
        <>
          <IconButton
            key={id}
            ref={anchorElTimer}
            onClick={() => setOpenTimerMenu(true)}
            sx={{ ...iconButtonStyle, color: timerColor }}
          >
            <AccessAlarm fontSize='small' />
          </IconButton>
          <Menu
            anchorEl={anchorElTimer.current}
            id='menu-item-management-timer'
            open={openTimerMenu}
            onClose={() => {
              setOpenTimerMenu(false);
            }}
          >
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
              <DateTimePicker
                viewRenderers={{
                  hours: renderTimeViewClock,
                  minutes: renderTimeViewClock,
                  seconds: renderTimeViewClock,
                }}
                label='タイマー'
                value={time}
                onChange={(newValue) => {
                  setTime(newValue);
                }}
                sx={{ marginX: 'auto', my: 2 }}
              />
            </Box>
            <Box sx={{ px: 2 }}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <>
                      <Checkbox checked={isUpLift} onChange={(e) => setIsUpLift(e.target.checked)} />
                      <Autocomplete
                        freeSolo
                        options={hours}
                        renderInput={(params) => <TextField {...params} label='時間' size='small' />}
                        value={upLiftHour !== undefined ? upLiftHour : null}
                        onChange={(_, newValue) => {
                          const parsedValue = parseInt(newValue as string, 10);
                          if (!isNaN(parsedValue) && parsedValue >= 0) {
                            setUpLiftHour(parsedValue);
                          } else {
                            setUpLiftHour(undefined);
                          }
                        }}
                        onInputChange={(_, newInputValue) => {
                          const parsedValue = parseInt(newInputValue, 10);
                          if (!isNaN(parsedValue) && parsedValue >= 0) {
                            setUpLiftHour(parsedValue);
                          } else {
                            setUpLiftHour(undefined);
                          }
                        }}
                        sx={{ width: 100, mr: 1 }}
                        size='small'
                        getOptionLabel={(option) => (option !== null ? option.toString() : '')}
                      />
                      <Autocomplete
                        freeSolo
                        options={minutes}
                        renderInput={(params) => <TextField {...params} label='分' size='small' />}
                        value={upLiftMinute !== undefined ? upLiftMinute : null}
                        onChange={(_, newValue) => {
                          const parsedValue = parseInt(newValue as string, 10);
                          if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue < 60) {
                            setUpLiftMinute(parsedValue);
                          } else {
                            setUpLiftMinute(undefined);
                          }
                        }}
                        onInputChange={(_, newInputValue) => {
                          const parsedValue = parseInt(newInputValue, 10);
                          if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue < 60) {
                            setUpLiftMinute(parsedValue);
                          } else {
                            setUpLiftMinute(undefined);
                          }
                        }}
                        sx={{ width: 80, mr: 1 }}
                        size='small'
                        getOptionLabel={(option) => (option !== null ? option.toString() : '')}
                      />
                    </>
                  }
                  label='前に上へ移動'
                />
              </FormGroup>
            </Box>
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', my: 2 }}>
              <Button
                onClick={() => {
                  if (!time) return;
                  const uh = upLiftHour ? upLiftHour * 60 : 0;
                  const um = upLiftMinute ? upLiftMinute : 0;
                  const uhm = uh + um === 0 ? undefined : uh + um;
                  // const nh = notifyHour ? notifyHour * 60 : 0;
                  // const nm = notifyMinute ? notifyMinute : 0;
                  // const nhm = nh + nm === 0 ? undefined : nh + nm;
                  handleSetTimer(id, time.toISOString(), isUpLift, uhm, undefined, undefined);
                  setOpenTimerMenu(false);
                }}
                variant='contained'
                color='primary'
                sx={{ mr: 2 }}
              >
                セット
              </Button>
              <Button
                onClick={() => {
                  handleSetTimer(id, undefined, undefined, undefined, undefined, undefined);
                  setOpenTimerMenu(false);
                }}
                variant='contained'
                color='error'
              >
                解除
              </Button>
            </Box>
          </Menu>
        </>
      )}
    </>
  );
}
