import AppMain from './AppMain';
import { DndContext, closestCenter, MeasuringStrategy } from '@dnd-kit/core';
import { useAppStateSync } from '../hooks/useAppStateSync';
import { useTreeManagement } from '../hooks/useTreeManagement';
import { useDndContext } from '../hooks/useDndContext';
import { useAuth } from '../hooks/useAuth';
import { ModalDialog } from '../components/ModalDialog';
import { InputDialog } from '../components/InputDialog';
import { ResponsiveDrawer } from './ResponsiveDrawer';
import { theme, darkTheme } from './mui_theme';
import { CssBaseline, ThemeProvider, Button, CircularProgress, Typography, Paper, Box } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useDialogStore } from '../store/dialogStore';
import { useInputDialogStore } from '../store/dialogStore';
import { useAppStateStore } from '../store/appStateStore';

export default function AppEntry() {
  const darkMode = useAppStateStore((state) => state.darkMode);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);
  const systemMessage = useAppStateStore((state) => state.systemMessage);
  const isWaitingForDelete = useAppStateStore((state) => state.isWaitingForDelete);
  const setIsWaitingForDelete = useAppStateStore((state) => state.setIsWaitingForDelete);

  const isDialogVisible = useDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);
  const isInputDialogVisible = useInputDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);

  // 認証状態の監視とログイン、ログアウトを行うカスタムフック
  const { handleLogin, handleLogout, handleDeleteAccount, auth } = useAuth();

  // アプリの状態の読み込みと保存を行うカスタムフック
  const { handleDownloadAppState } = useAppStateSync(auth);

  // ツリーの状態を同期するカスタムフック
  const { saveCurrentTreeName, deleteTree, handleCreateNewTree, handleListClick, handleFileUpload } = useTreeManagement(auth);

  // DndContextの状態を同期するカスタムフック
  const {
    handleDragStart,
    handleDragMove,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    modifiers,
    activeListId,
    activeTreeId,
    overTreeId,
    offsetLeft,
    projected,
    setProjected,
  } = useDndContext();

  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  return (
    <ThemeProvider theme={darkMode ? darkTheme : theme}>
      <CssBaseline />
      {isLoggedIn ? (
        !isWaitingForDelete ? (
          // ログイン後のメイン画面
          <DndContext
            collisionDetection={closestCenter}
            measuring={measuring}
            modifiers={modifiers}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {isDialogVisible && <ModalDialog />}
            {isInputDialogVisible && <InputDialog />}
            <ResponsiveDrawer
              handleCreateNewTree={handleCreateNewTree}
              handleListClick={handleListClick}
              handleFileUpload={handleFileUpload}
              handleDownloadAppState={handleDownloadAppState}
              handleLogout={handleLogout}
              activeId={activeListId}
            />
            <AppMain
              saveCurrentTreeName={saveCurrentTreeName}
              deleteTree={deleteTree}
              activeId={activeTreeId}
              overId={overTreeId}
              offsetLeft={offsetLeft}
              projected={projected}
              setProjected={setProjected}
            />
            {isLoading && (
              <CircularProgress
                sx={{
                  marginTop: 4,
                  display: 'block',
                  position: 'absolute',
                  left: { xs: 'calc(50% - 20px)', sm: 'calc(50% + 100px)' },
                }}
              />
            )}
          </DndContext>
        ) : (
          // アカウント削除の確認ダイアログ
          <>
            <Typography sx={{ marginBottom: 0 }} variant='h3'>
              <img src='/TaskTrees.svg' alt='Task Tree' style={{ width: '35px', height: '35px', marginRight: '10px' }} />
              TaskTrees
            </Typography>
            <Box sx={{ width: '100%', marginTop: -1, marginBottom: 4 }}>
              <Typography variant='caption' sx={{ width: '100%' }}>
                Team Edition
              </Typography>
            </Box>
            <Typography variant='body2' sx={{ marginY: 4 }}>
              アプリケーションのすべてのデータとアカウント情報が削除されます。この操作は取り消せません。削除を実行しますか？
            </Typography>
            <Button
              onClick={handleDeleteAccount}
              variant={'contained'}
              startIcon={<DeleteForeverIcon />}
              color='error'
              sx={{ marginRight: 4 }}
            >
              削除する
            </Button>
            <Button onClick={() => setIsWaitingForDelete(false)} variant={'outlined'}>
              キャンセル
            </Button>
          </>
        )
      ) : (
        // ログイン前の画面
        <>
          <Typography sx={{ marginBottom: 0 }} variant='h3'>
            <img src='/TaskTrees.svg' alt='Task Tree' style={{ width: '35px', height: '35px', marginRight: '10px' }} />
            TaskTrees
          </Typography>
          <Box sx={{ width: '100%', marginTop: -1, marginBottom: 4 }}>
            <Typography variant='caption' sx={{ width: '100%' }}>
              Team Edition
            </Typography>
          </Box>
          {isLoading ? (
            <CircularProgress
              sx={{
                marginY: 4,
                display: 'block',
                marginX: 'auto',
              }}
            />
          ) : (
            <Button onClick={() => handleLogin()} variant={'contained'}>
              Googleでログイン
            </Button>
          )}
          {systemMessage && (
            <Typography variant='body2' sx={{ marginY: 4 }}>
              {systemMessage}
            </Typography>
          )}

          <Paper sx={{ maxWidth: 300, margin: 'auto', marginTop: 4 }}>
            <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
              複数のツリー作成＆共同編集に対応したタスク管理アプリです。
              <br />
              <br />
              ツリーを共有するには、メンバーがこのアプリに登録している必要があります。
              <br />
              １ツリーのシンプルな個人用バージョンは<a href='https://tasktree-fb.web.app/'>こちら</a>です。
              ツリーデータは相互に移行可能です。
            </Typography>
          </Paper>
          <Typography variant='caption'>
            <a href='https://github.com/Jun-Murakami/TaskTrees'>©{new Date().getFullYear()} Jun Murakami</a>
          </Typography>
        </>
      )}
    </ThemeProvider>
  );
}
