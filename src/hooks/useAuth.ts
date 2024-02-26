import { useEffect } from 'react';
import { TreeItem, TreesList } from '../types/types';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { getDatabase, remove, ref } from 'firebase/database';
import { UniqueIdentifier } from '@dnd-kit/core';

// Firebaseの設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_DATABASE_URL,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGE_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
getDatabase(app);

export const useAuth = (
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setItems: React.Dispatch<React.SetStateAction<TreeItem[]>>,
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>,
  setCurrentTree: React.Dispatch<React.SetStateAction<UniqueIdentifier | null>>,
  setCurrentTreeName: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentTreeMembers: React.Dispatch<React.SetStateAction<{ uid: string; email: string }[] | null>>,
  isWaitingForDelete: boolean,
  setIsWaitingForDelete: React.Dispatch<React.SetStateAction<boolean>>
) => {
  // ログイン状態の監視
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Googleログイン
  const handleLogin = () => {
    signInWithRedirect(auth, provider)
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
    signOut(auth)
      .then(() => {
        setIsLoggedIn(false);
        setItems([]);
        setTreesList([]);
        setCurrentTree(null);
        setCurrentTreeName(null);
        setCurrentTreeMembers(null);
        if (!isWaitingForDelete) setMessage('ログアウトしました。');
      })
      .catch((error) => {
        console.error(error);
      });
  };

  // アカウント削除
  const handleDeleteAccount = () => {
    const user = auth.currentUser;
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
  return { handleLogin, handleLogout, handleDeleteAccount, auth };
};