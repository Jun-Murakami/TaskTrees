import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { getApp, initializeApp } from 'firebase/app';
import {
  getAuth, indexedDBLocalPersistence, initializeAuth, GoogleAuthProvider, signInWithCredential, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from 'firebase/auth';
import { getDatabase, remove, ref, get, set } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject, listAll } from 'firebase/storage';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { useObserve } from './useObserve';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useInputDialogStore } from '../store/dialogStore';

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
const db = getDatabase(app);

const getFirebaseAuth = async () => {
  if (Capacitor.isNativePlatform()) {
    return initializeAuth(getApp(), {
      persistence: indexedDBLocalPersistence,
    });
  } else {
    return getAuth();
  }
};

const auth = getFirebaseAuth();

export const useAuth = () => {
  const uid = useAppStateStore((state) => state.uid);
  const setUid = useAppStateStore((state) => state.setUid);
  const email = useAppStateStore((state) => state.email);
  const setEmail = useAppStateStore((state) => state.setEmail);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const setIsLoggedIn = useAppStateStore((state) => state.setIsLoggedIn);
  const setSystemMessage = useAppStateStore((state) => state.setSystemMessage);
  const isWaitingForDelete = useAppStateStore((state) => state.isWaitingForDelete);
  const setIsWaitingForDelete = useAppStateStore((state) => state.setIsWaitingForDelete);
  const setItems = useTreeStateStore((state) => state.setItems);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);

  const showInputDialog = useInputDialogStore((state) => state.showDialog);

  const { observeTimeStamp } = useObserve();

  // ログイン状態の監視
  useEffect(() => {
    const asyncFunc = async () => {
      await getFirebaseAuth();
    }
    asyncFunc();
    FirebaseAuthentication.addListener('authStateChange', async (result) => {
      setIsLoading(true);
      setIsLoggedIn(!!result.user);
      if (result.user) {
        setUid(result.user.uid);
        setEmail(result.user.email);
      }
      setIsLoading(false);
    });
    return () => {
      FirebaseAuthentication.removeAllListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (uid && email) {
      const asyncFunc = async () => {
        await observeTimeStamp();
      }
      asyncFunc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, email]);

  // Googleログイン
  const handleGoogleLogin = async () => {
    // 1. Create credentials on the native layer
    const result = await FirebaseAuthentication.signInWithGoogle();
    // 2. Sign in on the web layer using the id token
    const credential = GoogleAuthProvider.credential(result.credential?.idToken);
    await signInWithCredential(await auth, credential).then(() => {
      setIsLoggedIn(true);
      setSystemMessage(null);
    }).catch((error) => {
      setSystemMessage('Googleログインに失敗しました。\n\n' + error.code);
    });
  };

  // メールアドレスとパスワードでのログイン
  const handleEmailLogin = async (email: string, password: string) => {
    if (email === '' || password === '') {
      setSystemMessage('メールアドレスとパスワードを入力してください。');
      return;
    }
    const result = await FirebaseAuthentication.signInWithEmailAndPassword({
      email,
      password,
    });
    if (result.credential) {
      const firebaseCredential = GoogleAuthProvider.credential(result.credential.idToken);
      await signInWithCredential(await auth, firebaseCredential).then(() => {
        setIsLoggedIn(true);
        setSystemMessage(null);

      }).catch((error) => {
        if (error.code === 'auth/invalid-credential') {
          setSystemMessage('ログインに失敗しました。Googleログインで使用したメールアドレスでログインする場合は、パスワードのリセットを行ってください。');
        } else {
          setSystemMessage('ログインに失敗しました。\n\n' + error.code);
        }
      });
    }
  };

  // メールアドレスとパスワードでサインアップ
  const handleSignup = async (email: string, password: string) => {
    if (email === '' || password === '') {
      setSystemMessage('メールアドレスとパスワードを入力してください。');
      return;
    }
    createUserWithEmailAndPassword(await auth, email, password)
      .then(() => {
        setSystemMessage('メールアドレスの確認メールを送信しました。メールボックスを確認してください。');
      })
      .catch((error) => {
        console.error(error);
        if (error.code === 'auth/email-already-in-use') {
          setSystemMessage('このメールアドレスは既に使用されています。');
        } else {
          setSystemMessage('サインアップに失敗しました。\n\n' + error.code);
        }
      });
  };

  // パスワードをリセット
  const handleResetPassword = async () => {
    const result = await showInputDialog(
      'パスワードをリセットするメールアドレスを入力してください',
      'Password Reset',
      'メールアドレス',
      '',
      false
    );
    console.log(result);
    if (result === '') {
      setSystemMessage('メールアドレスを入力してください。');
      return;
    }
    sendPasswordResetEmail(await auth, result)
      .then(() => {
        setSystemMessage('パスワードリセットメールを送信しました。メールボックスを確認してください。');
      })
      .catch((error) => {
        if (error.code === 'auth/invalid-email') {
          setSystemMessage('パスワードのリセットに失敗しました。メールアドレスを確認してください。');
        } else {
          setSystemMessage('パスワードのリセットに失敗しました。\n\n' + error.code);
        }
      });
  };

  // ログアウト
  const handleLogout = async () => {
    signOut(await auth)
      .then(async () => {
        await FirebaseAuthentication.signOut();
        setIsLoggedIn(false);
        setUid(null);
        setEmail(null);
        setItems([]);
        setTreesList([]);
        setCurrentTree(null);
        setCurrentTreeName(null);
        setCurrentTreeMembers(null);
        if (!isWaitingForDelete) setSystemMessage('ログアウトしました。');
      })
      .catch((error) => {
        console.error(error);
      });
  };

  // アカウント削除
  const handleDeleteAccount = async () => {
    const authObject = await getFirebaseAuth();
    const user = authObject.currentUser;
    if (user) {
      setIsLoading(true);

      // Promiseを保持するための配列を用意
      const deletePromises: Promise<void>[] = [];
      // treesListを反復処理して、ユーザーのツリーを削除
      for (const tree of treesList) {
        const treeRef = ref(db, `trees/${tree.id}`);
        // membersをDBから取得して、自分のユーザー以外のユーザーIDが含まれていたらメンバーから自分を削除するだけにする
        const treeMembersRef = ref(db, `trees/${tree.id}/members`);
        await get(treeMembersRef)
          .then((snapshot) => {
            if (snapshot.exists()) {
              const members = snapshot.val();
              // 自分のユーザーID以外が含まれていたらメンバーから自分を削除
              if (members && Object.keys(members).filter((uid) => uid !== user.uid).length > 0) {
                const newMembers = { ...members };
                delete newMembers[user.uid];
                set(treeMembersRef, newMembers)
                  .then(() => {
                    console.log('ツリーのメンバーから自分を削除しました。');
                  })
                  .catch((error) => {
                    handleLogout();
                    setSystemMessage('ツリーのメンバーから自分を削除中にエラーが発生しました\n\n' + error);
                    if (isLoading) setIsLoading(false);
                    return;
                  });
              } else {
                // 自分のユーザーIDが含まれていない場合はツリーを削除
                remove(treeRef)
                  .then(() => {
                    console.log('ツリーが正常に削除されました。');
                  })
                  .catch((error) => {
                    handleLogout();
                    setSystemMessage('ツリーの削除中にエラーが発生しました。code1\n\n' + error);
                    if (isLoading) setIsLoading(false);
                    return;
                  });
                // ユーザーのbucketを削除
                const deleteAllFilesInUserDirectory = async () => {
                  const storage = getStorage();
                  const userDirectoryRef = storageRef(storage, `trees/${tree.id}`);

                  try {
                    const fileList = await listAll(userDirectoryRef);
                    const deletePromises = fileList.items.map(async (fileRef) => await deleteObject(fileRef));
                    await Promise.all(deletePromises);
                    console.log(`ツリー${tree.id}のファイルが削除されました。`);
                  } catch (error) {
                    console.log(`ツリー${tree.id}の削除対象ファイルはありません。`);
                  }
                };
                // deleteAllFilesInUserDirectoryを非同期で実行し、Promiseを配列に追加
                deletePromises.push(deleteAllFilesInUserDirectory().catch((error) => console.error(error)));
              }
            }
          })
          .catch((error) => {
            handleLogout();
            setSystemMessage('ツリーの削除中にエラーが発生しました。code2\n\n' + error);
            if (isLoading) setIsLoading(false);
            return;
          });
      }
      // ユーザーのappStateを削除
      const appStateRef = await ref(db, `users/${user.uid}`);
      await remove(appStateRef)
        .then(() => {
          console.log('データが正常に削除されました。');
        })
        .catch((error) => {
          handleLogout();
          setSystemMessage('データの削除中にエラーが発生しました\n\n' + error);
          if (isLoading) setIsLoading(false);
          return;
        });

      // ユーザーを削除
      user
        .delete()
        .then(() => {
          handleLogout();
          setSystemMessage('アカウントが削除されました。');
          if (isLoading) setIsLoading(false);
        })
        .catch((error) => {
          if (error instanceof Error) {
            setSystemMessage('アカウントの削除中にエラーが発生しました。管理者に連絡してください。 : \n\n' + error.message);
          } else {
            setSystemMessage('アカウントの削除中にエラーが発生しました。管理者に連絡してください。 : 不明なエラー');
          }
          if (isLoading) setIsLoading(false);
          handleLogout();
          return;
        });
    } else {
      setSystemMessage('ユーザーがログインしていません。');
    }
    setIsWaitingForDelete(false);
  };
  return { handleGoogleLogin, handleEmailLogin, handleSignup, handleResetPassword, handleLogout, handleDeleteAccount };
};
