import { useState } from 'react';
import AppMain from './AppMain';
import { TreeItem, TreesList } from '../types/types';
import { useAppStateSync } from '../hooks/useAppStateSync';
import { useTreeManagement } from '../hooks/useTreeManagement';
import { useAuth } from '../hooks/useAuth';
import { ModalDialog } from '../components/ModalDialog';
import { InputDialog } from '../components/InputDialog';
import { ResponsiveDrawer } from './ResponsiveDrawer';
import { theme, darkTheme } from './mui_theme';
import { CssBaseline, ThemeProvider, Button, CircularProgress, Typography, Paper, Box } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useDialogStore } from '../store/dialogStore';
import { useInputDialogStore } from '../store/dialogStore';
import { UniqueIdentifier } from '@dnd-kit/core';

export default function AppEntry() {
  const [darkMode, setDarkMode] = useState(false);
  const [items, setItems] = useState<TreeItem[]>([]);
  const [hideDoneItems, setHideDoneItems] = useState(false);
  const [treesList, setTreesList] = useState<TreesList>([]);
  const [currentTree, setCurrentTree] = useState<UniqueIdentifier | null>(null);
  const [currentTreeName, setCurrentTreeName] = useState<string | null>(null);
  const [currentTreeMembers, setCurrentTreeMembers] = useState<{ uid: string; email: string }[] | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isWaitingForDelete, setIsWaitingForDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isDialogVisible = useDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);
  const isInputDialogVisible = useInputDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);

  // 認証状態の監視とログイン、ログアウトを行うカスタムフック
  const { handleLogin, handleLogout, handleDeleteAccount } = useAuth(
    setIsLoggedIn,
    setIsLoading,
    setMessage,
    setItems,
    setTreesList,
    setCurrentTree,
    setCurrentTreeName,
    setCurrentTreeMembers,
    isWaitingForDelete,
    setIsWaitingForDelete
  );

  // アプリの状態の読み込みと保存を行うカスタムフック
  const { handleDownloadAppState } = useAppStateSync(
    items,
    setItems,
    hideDoneItems,
    setHideDoneItems,
    darkMode,
    setDarkMode,
    isLoggedIn,
    setIsLoggedIn,
    setIsLoading,
    setMessage
  );

  //ツリーの状態を同期するカスタムフック
  const { saveCurrentTreeName, deleteTree, handleCreateNewTree, handleListClick, handleFileUpload } = useTreeManagement(
    items,
    setItems,
    setMessage,
    isLoggedIn,
    setIsLoggedIn,
    setIsLoading,
    currentTree,
    setCurrentTree,
    setCurrentTreeName,
    setCurrentTreeMembers,
    treesList,
    setTreesList,
    isExpanded,
    setIsExpanded,
    setIsFocused
  );

  return (
    <ThemeProvider theme={darkMode ? darkTheme : theme}>
      <CssBaseline />
      {isLoggedIn ? (
        !isWaitingForDelete ? (
          // ログイン後のメイン画面
          <>
            {isDialogVisible && <ModalDialog />}
            {isInputDialogVisible && <InputDialog />}
            <ResponsiveDrawer
              handleCreateNewTree={handleCreateNewTree}
              treesList={treesList}
              setTreesList={setTreesList}
              hideDoneItems={hideDoneItems}
              setHideDoneItems={setHideDoneItems}
              currentTree={currentTree}
              handleListClick={handleListClick}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              handleFileUpload={handleFileUpload}
              handleDownloadAppState={handleDownloadAppState}
              handleLogout={handleLogout}
              setIsWaitingForDelete={setIsWaitingForDelete}
            />
            <AppMain
              items={items}
              setItems={setItems}
              hideDoneItems={hideDoneItems}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              handleLogout={handleLogout}
              setIsWaitingForDelete={setIsWaitingForDelete}
              currentTree={currentTree}
              currentTreeName={currentTreeName}
              setCurrentTreeName={setCurrentTreeName}
              saveCurrentTreeName={saveCurrentTreeName}
              setTreesList={setTreesList}
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              currentTreeMembers={currentTreeMembers}
              deleteTree={deleteTree}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
            />
            {isLoading && <CircularProgress sx={{ marginTop: 2 }} />}
          </>
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
          <Button onClick={() => handleLogin()} variant={'contained'}>
            Googleでログイン
          </Button>
          {message && (
            <Typography variant='body2' sx={{ marginY: 4 }}>
              {message}
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
