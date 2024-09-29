import { useEffect, useCallback } from 'react';
import { getApp, initializeApp } from 'firebase/app';
import {
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  Unsubscribe,
} from 'firebase/auth';
import { getDatabase, remove, ref, get, set } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject, listAll } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { useObserve } from '@/hooks/useObserve';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useInputDialogStore } from '@/store/dialogStore';

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

initializeApp(firebaseConfig);

const getFirebaseAuth = () => {
  if (Capacitor.isNativePlatform()) {
    return initializeAuth(getApp(), {
      persistence: indexedDBLocalPersistence,
    });
  } else {
    return getAuth();
  }
};

const auth = getFirebaseAuth();

type UserComact = {
  uid: string | null;
  email: string | null;
};

export const useAuth = () => {
  const isOffline = useAppStateStore((state) => state.isOffline);
  const setIsOffline = useAppStateStore((state) => state.setIsOffline);
  const setUid = useAppStateStore((state) => state.setUid);
  const setEmail = useAppStateStore((state) => state.setEmail);
  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const setIsLoggedIn = useAppStateStore((state) => state.setIsLoggedIn);
  const setSystemMessage = useAppStateStore((state) => state.setSystemMessage);
  const isWaitingForDelete = useAppStateStore((state) => state.isWaitingForDelete);
  const setIsWaitingForDelete = useAppStateStore((state) => state.setIsWaitingForDelete);
  const setItems = useTreeStateStore((state) => state.setItems);
  const setPrevCurrentTree = useTreeStateStore((state) => state.setPrevCurrentTree);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);

  const showInputDialog = useInputDialogStore((state) => state.showDialog);

  const { observeTimeStamp } = useObserve();

  const loginAction = useCallback(async (user: UserComact | null) => {
    setIsLoggedIn(!!user);
    setIsLoading(!!user);
    if (user) {
      setUid(user.uid);
      setEmail(user.email);
      setIsOffline(false);
      await observeTimeStamp();
    }
  },
    [setIsLoggedIn, setIsLoading, setUid, setEmail, setIsOffline, observeTimeStamp]
  );

  // ログイン状態の監視
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    const asyncFunc = async () => {
      if (Capacitor.isNativePlatform() && FirebaseAuthentication) {
        FirebaseAuthentication.addListener('authStateChange', async (result) => {
          console.log('authStateChange in 1:', result);
          await loginAction(result.user);
        });
      } else {
        unsubscribe = auth.onAuthStateChanged(async (user) => {
          console.log('authStateChange in 2:', user);
          await loginAction(user);
        });
      }
    };
    asyncFunc();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      FirebaseAuthentication.removeAllListeners();
    };
  }, [loginAction]);

  // Googleログイン
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setSystemMessage('ログイン中...');
    // 1. Create credentials on the native layer
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      // 2. Sign in on the web layer using the id token
      const credential = GoogleAuthProvider.credential(result.credential?.idToken);
      await signInWithCredential(auth, credential)
        .then(async () => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          setSystemMessage('Googleログインに失敗しました。Code:100\n\n' + error.code);
          setIsLoading(false);
        });
    } catch (error) {
      setSystemMessage('Googleログインに失敗しました。Code:101\n\n' + error);
      setIsLoading(false);
      return;
    }
  };

  //Appleログイン
  const handleAppleLogin = async () => {
    setIsLoading(true);
    setSystemMessage('ログイン中...');
    if (Capacitor.isNativePlatform() && FirebaseAuthentication) {
      // 1. Create credentials on the native layer
      try {
        const result = await FirebaseAuthentication.signInWithApple();
        // 2. Sign in on the web layer using the id token
        const provider = new OAuthProvider('apple.com');
        if (!result.credential) {
          setSystemMessage('Appleログインに失敗しました。Code:103\n\ncredentialが取得できませんでした。');
          setIsLoading(false);
          return;
        }
        const credential = provider.credential({ idToken: result.credential.idToken, rawNonce: result.credential.nonce });
        await signInWithCredential(auth, credential)
          .then(async () => {
            setIsLoggedIn(true);
            setSystemMessage(null);
          })
          .catch((error) => {
            setSystemMessage('Appleログインに失敗しました。Code:104\n\n' + error.code);
            setIsLoading(false);
          });
      } catch (error) {
        setSystemMessage('Appleログインに失敗しました。Code:105\n\n' + error);
        setIsLoading(false);
        return;
      }
    } else {
      const provider = new OAuthProvider('apple.com');
      signInWithPopup(getAuth(), provider)
        .then(() => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          setSystemMessage('Appleログインに失敗しました。Code:106\n\n' + error.code);
          setIsLoading(false);
        });
    }
  };

  // メールアドレスとパスワードでのログイン
  const handleEmailLogin = async (email: string, password: string) => {
    if (email === '' || password === '') {
      setSystemMessage('メールアドレスとパスワードを入力してください。');
      return;
    }
    setSystemMessage('ログイン中...');
    setIsLoading(true);
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        setIsLoggedIn(true);
        setSystemMessage(null);
      })
      .catch((error) => {
        if (error.code === 'auth/invalid-credential') {
          setSystemMessage(
            'ログインに失敗しました。メールアドレスとパスワードを確認してください。Googleログインで使用したメールアドレスでログインする場合は、パスワードのリセットを行ってください。'
          );
        } else if (error.code === 'auth/invalid-login-credentials') {
          setSystemMessage(
            'ログインに失敗しました。メールアドレスとパスワードを確認してください。Googleログインで使用したメールアドレスでログインする場合は、パスワードのリセットを行ってください。'
          );
        } else {
          setSystemMessage('ログインに失敗しました。Code:107\n\n' + error.code);
        }
        setIsLoading(false);
      });
  };

  // メールアドレスとパスワードでサインアップ
  const handleSignup = async (email: string, password: string) => {
    if (email === '' || password === '') {
      setSystemMessage('メールアドレスとパスワードを入力してください。');
      return;
    }
    if (Capacitor.isNativePlatform() && FirebaseAuthentication) {
      await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password })
        .then(() => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          if (error.code === 'auth/email-already-in-use') {
            setSystemMessage('このメールアドレスは既に使用されています。');
          } else if (error.code === 'auth/weak-password') {
            setSystemMessage('パスワードが弱すぎます。6文字以上のパスワードを設定してください。');
          } else {
            setSystemMessage('サインアップに失敗しました。Code:108\n\n' + error.code);
          }
        });
    } else {
      createUserWithEmailAndPassword(auth, email, password)
        .then(() => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          console.error(error);
          if (error.code === 'auth/email-already-in-use') {
            setSystemMessage('このメールアドレスは既に使用されています。');
          } else if (error.code === 'auth/weak-password') {
            setSystemMessage('パスワードが弱すぎます。6文字以上のパスワードを設定してください。');
          } else {
            setSystemMessage('サインアップに失敗しました。Code:109\n\n' + error.code);
          }
        });
    }
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
      return;
    }
    sendPasswordResetEmail(auth, result)
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
    signOut(getAuth())
      .then(async () => {
        if (Capacitor.isNativePlatform() && FirebaseAuthentication && !isOffline) {
          await FirebaseAuthentication.signOut();
          FirebaseAuthentication.removeAllListeners();
        }
        setIsLoggedIn(false);
        setUid(null);
        setEmail(null);
        setPrevCurrentTree(null);
        setPrevItems([]);
        setItems([]);
        setTreesList([]);
        setCurrentTree(null);
        setCurrentTreeName(null);
        setCurrentTreeMembers(null);
        if (!isWaitingForDelete && !isOffline) {
          setSystemMessage('ログアウトしました。');
        } else {
          setSystemMessage('');
        }
        setIsOffline(false);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  // アカウント削除
  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (user) {
      setIsLoading(true);

      // Promiseを保持するための配列を用意
      const deletePromises: Promise<void>[] = [];
      // treesListを反復処理して、ユーザーのツリーを削除
      for (const tree of treesList) {
        const treeRef = ref(getDatabase(), `trees/${tree.id}`);
        // membersをDBから取得して、自分のユーザー以外のユーザーIDが含まれていたらメンバーから自分を削除するだけにする
        const treeMembersRef = ref(getDatabase(), `trees/${tree.id}/members`);
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
                  } catch {
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
      const appStateRef = ref(getDatabase(), `users/${user.uid}`);
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

  return {
    handleGoogleLogin,
    handleAppleLogin,
    handleEmailLogin,
    handleSignup,
    handleResetPassword,
    handleLogout,
    handleDeleteAccount,
  };
};
