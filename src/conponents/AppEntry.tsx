import { useState, useEffect } from 'react';
import AppMain from './AppMain';
import { TreeItem, TreesList } from './Tree/types.ts';
import { useAppStateSync } from '../hooks/useAppStateSync';
import { useTreeManagement } from '../hooks/useTreeManagement';
import { initialItems } from '../conponents/Tree/mock';
import { ModalDialog } from '../conponents/ModalDialog';
import { InputDialog } from '../conponents/InputDialog';
import ResponsiveDrawer from './ResponsiveDrawer';
import { theme, darkTheme } from './mui_theme';
import { CssBaseline, ThemeProvider, Button, CircularProgress, Typography, Paper } from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getDatabase, remove, ref, push, set } from 'firebase/database';
import { useDialogStore } from '../store/dialogStore';
import { useInputDialogStore } from '../store/dialogStore';

export default function AppEntry() {
  const [darkMode, setDarkMode] = useState(false);
  const [items, setItems] = useState<TreeItem[]>([]);
  const [hideDoneItems, setHideDoneItems] = useState(false);
  const [treesList, setTreesList] = useState<TreesList>(null);
  const [currentTree, setCurrentTree] = useState<string | null>(null);
  const [currentTreeName, setCurrentTreeName] = useState<string | null>(null);
  const [currentTreeMembers, setCurrentTreeMembers] = useState<string[] | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isWaitingForDelete, setIsWaitingForDelete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [membersEmails, setMembersEmails] = useState<string[] | null>(null);

  const isDialogVisible = useDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);
  const isInputDialogVisible = useInputDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);
  const showDialog = useDialogStore((state) => state.showDialog);

  // ログイン状態の監視
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Googleログイン
  const handleLogin = () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(() => {
        setIsLoggedIn(true);
        setMessage(null);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  // ログアウト
  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        setIsLoggedIn(false);
        setItems([]);
        setTreesList(null);
        setCurrentTree(null);
        setCurrentTreeName(null);
        setCurrentTreeMembers(null);
        if (!isWaitingForDelete) setMessage('ログアウトしました。');
      })
      .catch((error) => {
        console.error(error);
      });
  };

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
  const { saveTreesList, saveCurrentTreeName, saveCurrentTreeMembers, deleteTree } = useTreeManagement(
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
    setMembersEmails
  );

  // 新しいツリーを作成する
  const handleCreateNewTree = async () => {
    // この関数が非同期であることを確認してください
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    const db = getDatabase();
    const treesRef = ref(db, 'trees');
    const newTreeRef = push(treesRef);
    await set(newTreeRef, {
      items: initialItems,
      name: '新しいツリー',
      members: [user?.uid],
    });
    setCurrentTree(newTreeRef.key);
    setCurrentTreeName('新しいツリー');
    setCurrentTreeMembers([user?.uid]);

    // 非同期処理を行うための別の関数を定義
    const updateTreesListAsync = async (key: unknown, prev: TreesList) => {
      if (typeof key === 'string' || typeof key === 'number') {
        const newTreesList = { ...prev, [key]: '新しいツリー' };
        await saveTreesList(newTreesList);
        return newTreesList;
      } else {
        await showDialog('ツリーの作成に失敗しました。キーが無効です。' + key, 'Error');
        return prev;
      }
    };

    setTreesList((prev) => {
      updateTreesListAsync(newTreeRef.key, prev)
        .then((newList) => {
          return newList; // 新しい状態を返す
        })
        .catch((error) => {
          console.error(error);
          return prev; // エラーが発生した場合、前の状態を返す
        });
      return prev; // 非同期処理が完了する前に、一時的に前の状態を返す
    });
    setIsExpanded(true);
  };

  const handleListClick = (treeId: string) => {
    setCurrentTree(treeId);
  };

  // アカウント削除
  const handleDeleteAccount = () => {
    const user = getAuth().currentUser;
    if (user) {
      const db = getDatabase();
      const appStateRef = ref(db, `users/${user.uid}/appState`);
      remove(appStateRef)
        .then(() => {
          console.log('データが正常に削除されました。');
        })
        .catch((error) => {
          console.error('データの削除中にエラーが発生しました:', error);
        });
      user
        .delete()
        .then(() => {
          handleLogout();
          setMessage('アカウントが削除されました。');
        })
        .catch((error) => {
          if (error instanceof Error) {
            setMessage('アカウントの削除中にエラーが発生しました。管理者に連絡してください。 : ' + error.message);
          } else {
            setMessage('アカウントの削除中にエラーが発生しました。管理者に連絡してください。 : 不明なエラー');
          }
          handleLogout();
        });
    } else {
      setMessage('ユーザーがログインしていません。');
    }
    setIsWaitingForDelete(false);
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
              membersEmails={membersEmails}
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
