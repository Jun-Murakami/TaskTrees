import { useState, useEffect } from 'react';
import AppMain from './AppMain';
import { TreeItem, TreesList } from './Tree/types.ts';
import { useAppStateSync } from '../hooks/useAppStateSync';
import { useTreeManagement } from '../hooks/useTreeManagement';
import { useAuth } from '../hooks/useAuth';
import { ModalDialog } from '../conponents/ModalDialog';
import { InputDialog } from '../conponents/InputDialog';
import ResponsiveDrawer from './ResponsiveDrawer';
import { theme, darkTheme } from './mui_theme';
import { CssBaseline, ThemeProvider, Button, CircularProgress, Typography, Paper } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useDialogStore } from '../store/dialogStore';
import { useInputDialogStore } from '../store/dialogStore';

export default function AppEntry() {
  const [darkMode, setDarkMode] = useState(false);
  const [items, setItems] = useState<TreeItem[]>([]);
  const [hideDoneItems, setHideDoneItems] = useState(false);
  const [treesList, setTreesList] = useState<TreesList>(null);
  const [currentTree, setCurrentTree] = useState<string | null>(null);
  const [currentTreeName, setCurrentTreeName] = useState<string | null>(null);
  const [currentTreeMembers, setCurrentTreeMembers] = useState<{ uid: string; email: string }[] | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isWaitingForDelete, setIsWaitingForDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
  useAppStateSync(
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
  const { saveCurrentTreeName, deleteTree, handleCreateNewTree } = useTreeManagement(
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
    setTreesList,
    setIsExpanded
  );

  // ツリーのリストから選択されたツリーを表示する
  const handleListClick = (treeId: string) => {
    setCurrentTree(treeId);
  };

  return (
    <ThemeProvider theme={darkMode ? darkTheme : theme}>
      <CssBaseline />
      {isLoggedIn ? (
        !isWaitingForDelete ? (
          <>
            {isDialogVisible && <ModalDialog />}
            {isInputDialogVisible && <InputDialog />}
            <ResponsiveDrawer
              handleCreateNewTree={handleCreateNewTree}
              treesList={treesList}
              currentTree={currentTree}
              handleListClick={handleListClick}
            />
            <AppMain
              items={items}
              setItems={setItems}
              hideDoneItems={hideDoneItems}
              setHideDoneItems={setHideDoneItems}
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
            />
            {isLoading && <CircularProgress sx={{ marginTop: 2 }} />}
          </>
        ) : (
          <>
            <Typography sx={{ marginBottom: 4 }} variant='h3'>
              <img src='/TaskTrees.svg' alt='Task Tree' style={{ width: '35px', height: '35px', marginRight: '10px' }} />
              TaskTrees<Typography variant='caption'>Team Edition</Typography>
            </Typography>
            <Typography variant='body2' sx={{ marginY: 4 }}>
              アプリケーションのすべてのデータとアカウント情報が削除されます。この操作は取り消せません。削除しますか？
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
        <>
          <Typography sx={{ marginBottom: 4 }} variant='h3'>
            <img src='/TaskTrees.svg' alt='Task Tree' style={{ width: '35px', height: '35px', marginRight: '10px' }} />
            TaskTrees<Typography variant='caption'>Team Edition</Typography>
          </Typography>

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
              2024.2.24 データの保存先をGoogle Firebaseに変更しました。
              <br />
              <br />
              このバージョンでは、ユーザーデータはGoogleのFirebaseサーバに保存されます。 データをユーザーアカウントのGoogle
              Driveに保存する旧バージョンには<a href='https://task--tree.web.app/'>こちら</a>
              からアクセスできます。
              <br />
              データを移行するには、旧バージョンでログイン後にデータをダウンロードし、 手動でアップロードを行ってください。
            </Typography>
          </Paper>
          <Typography variant='caption'>
            <a href='https://github.com/Jun-Murakami/TaskTree-Fb'>©{new Date().getFullYear()} Jun Murakami</a>
          </Typography>
        </>
      )}
    </ThemeProvider>
  );
}
