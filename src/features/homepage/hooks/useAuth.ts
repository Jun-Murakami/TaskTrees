import { useEffect, useCallback } from 'react';
import { getApp, initializeApp, FirebaseError } from 'firebase/app';
import {
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  GoogleAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  Unsubscribe,
  signInWithRedirect,
  getRedirectResult,
  updateEmail,
  linkWithCredential,
  linkWithPopup,
  unlink,
  OAuthCredential,
  UserInfo,
} from 'firebase/auth';
import { getDatabase, remove, ref, get, set } from 'firebase/database';
import { getStorage, ref as storageRef, deleteObject, listAll } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { useObserve } from '@/hooks/useObserve';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import * as idbService from '@/services/indexedDbService';
import { useInputDialogStore } from '@/store/dialogStore';
import { useDialogStore } from '@/store/dialogStore';

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

getFirebaseAuth();

const auth = getAuth();

type UserComact = {
  uid: string | null;
  email: string | null;
};

const isElectron = navigator.userAgent.includes('Electron');

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
  const setItemsTreeId = useTreeStateStore((state) => state.setItemsTreeId);
  const setPrevCurrentTree = useTreeStateStore((state) => state.setPrevCurrentTree);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);
  const treesList = useTreeStateStore((state) => state.treesList);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);

  const showDialog = useDialogStore((state) => state.showDialog);
  const showInputDialog = useInputDialogStore((state) => state.showDialog);

  const { observeTimeStamp } = useObserve();

  const loginAction = useCallback(async (user: UserComact | null) => {
    try {
      setIsLoggedIn(!!user);
      setIsLoading(!!user);
      if (user && user.uid) {
        setUid(user.uid);
        setEmail(user.email);
        setIsOffline(false);
        await observeTimeStamp(user.uid);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message + error.stack : 'ログイン監視エラー');
    }
  },
    [setIsLoggedIn, setIsLoading, setUid, setEmail, setIsOffline, observeTimeStamp]
  );

  // ログイン状態の監視
  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null;
    const asyncFunc = async () => {
      try {
        unsubscribe = auth.onAuthStateChanged(async (user) => {
          await loginAction(user);
        });
      } catch (error) {
        await showDialog('ログイン状態の監視でエラーが発生しました\n\n' + error, 'Error');
      }
    };
    asyncFunc();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loginAction, showDialog, setIsLoggedIn, setIsLoading]);

  // クレデンシャルを監視してログイン
  const handleCredentialLogin = useCallback((recievedCredential: OAuthCredential) => {
    if (recievedCredential) {
      setIsLoading(true);
      setSystemMessage('ログイン中...');
      signInWithCredential(auth, recievedCredential)
        .then(() => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          setSystemMessage('ログインに失敗しました。Code:99\n\n' + error);
          setIsLoading(false);
        });
    }
  }, [setIsLoggedIn, setIsLoading, setSystemMessage]);

  //リダイレクト状態の監視
  useEffect(() => {
    getRedirectResult(getAuth()).catch((error) => {
      console.error(error);
    });
  }, [setIsLoggedIn, setIsLoading]);

  // Googleログイン
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setSystemMessage('ログイン中...');
    if (Capacitor.isNativePlatform() && FirebaseAuthentication) {
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
        setSystemMessage('Googleログインに失敗しました。Code:101\n\n' + (error instanceof Error ? error.message : 'Unknown error'));
        setIsLoading(false);
        return;
      }
    } else if (isElectron) {
      await window.electron!.openOAuthURL(`https://${import.meta.env.VITE_ELECTRON_AUTH_DOMAIN}/auth/google`).then((credential: OAuthCredential) => {
        const googleCredential = GoogleAuthProvider.credential(credential.idToken, credential.accessToken);
        handleCredentialLogin(googleCredential);
      }).catch((error: Error) => {
        if (error.message.includes('closed-by-user')) {
          setSystemMessage('Googleログインがキャンセルされました。');
        } else {
          setSystemMessage('Googleログインに失敗しました。Code:102\n\n' + (error instanceof Error ? error.message : 'Unknown error'));
        }
        setIsLoading(false);
      });
    } else {
      const provider = new OAuthProvider('google.com');
      signInWithRedirect(getAuth(), provider)
        .then(() => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          setSystemMessage('Googleログインに失敗しました。Code:103\n\n' + error.code);
          setIsLoading(false);
        });
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
          setSystemMessage('Appleログインに失敗しました。Code:104\n\ncredentialが取得できませんでした。');
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
            setSystemMessage('Appleログインに失敗しました。Code:105\n\n' + error.code);
            setIsLoading(false);
          });
      } catch (error) {
        setSystemMessage('Appleログインに失敗しました。Code:106\n\n' + (error instanceof Error ? error.message : 'Unknown error'));
        setIsLoading(false);
        return;
      }
    } else if (isElectron) {
      await window.electron!.openOAuthURL(`https://${import.meta.env.VITE_ELECTRON_AUTH_DOMAIN}/auth/apple`).then((credential: OAuthCredential) => {
        const appleCredential = OAuthProvider.credentialFromJSON(credential);
        handleCredentialLogin(appleCredential);
      }).catch((error: Error) => {
        if (error.message.includes('closed-by-user')) {
          setSystemMessage('Appleログインがキャンセルされました。');
        } else {
          setSystemMessage('Appleログインに失敗しました。Code:107\n\n' + (error instanceof Error ? error.message : 'Unknown error'));
        }
        setIsLoading(false);
      });
    } else {
      const provider = new OAuthProvider('apple.com');
      signInWithRedirect(getAuth(), provider)
        .then(() => {
          setIsLoggedIn(true);
          setSystemMessage(null);
        })
        .catch((error) => {
          setSystemMessage('Appleログインに失敗しました。Code:108\n\n' + error.code);
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
          setSystemMessage('ログインに失敗しました。Code:109\n\n' + error.code);
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
            setSystemMessage('サインアップに失敗しました。Code:110\n\n' + error.code);
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
            setSystemMessage('サインアップに失敗しました。Code:111\n\n' + error.code);
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

  // メールアドレスの変更
  const handleChangeEmail = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSystemMessage('ユーザーがログインしていません。');
      return;
    }
    const emailResult = await showInputDialog('新しいメールアドレスを入力してください', 'Change Email', 'メールアドレス', '', false);
    if (emailResult === '') {
      return;
    }
    await updateEmail(user, emailResult)
      .then(() => {
        showDialog('メールアドレス確認メールを送信しました。新しいアドレスが確認されるまでメールアドレスは変更されません。', 'Confirmation Email Sent');
      })
      .catch((error) => {
        if (error instanceof FirebaseError && error.code === 'auth/requires-recent-login') {
          showDialog('セキュリティの制限により、メールドレスの変更はユーザー自身のログインから一定時間内に行う必要があります。一度ログアウトしてからログインし、再度アカウント削除を実行してください。', 'Security Restriction');
        } else {
          showDialog('メールアドレスの変更に失敗しました。Code:113\n\n' + error.code, 'Change Email Failed');
        }
      });
  };

  // 紐づいているプロバイダー一覧を取得
  const getLinkedProviders = useCallback((): UserInfo[] => {
    const user = auth.currentUser;
    if (!user) return [];
    return user.providerData;
  }, []);

  // Googleアカウントを紐づけ
  const handleLinkGoogle = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSystemMessage('ユーザーがログインしていません。');
      return;
    }
    try {
      if (Capacitor.isNativePlatform() && FirebaseAuthentication) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        await linkWithCredential(user, credential);
      } else if (isElectron) {
        const oauthCredential = await window.electron!.openOAuthURL(
          `https://${import.meta.env.VITE_ELECTRON_AUTH_DOMAIN}/auth/google`
        );
        const credential = GoogleAuthProvider.credential(oauthCredential.idToken, oauthCredential.accessToken);
        await linkWithCredential(user, credential);
      } else {
        const provider = new GoogleAuthProvider();
        await linkWithPopup(user, provider);
      }
      await showDialog('Googleアカウントを紐づけました。', 'Account Linked');
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/provider-already-linked') {
          await showDialog('Googleアカウントを紐づけました。', 'Account Linked');
        } else if (error.code === 'auth/credential-already-in-use') {
          await showDialog(
            'このGoogleアカウントは既に別のアカウントに紐づけられています。先にそちらのアカウントからGoogleの紐づけを解除してください。',
            'Error'
          );
        } else if (error.code === 'auth/requires-recent-login') {
          await showDialog(
            'セキュリティの制限により、アカウントの紐づけはログインから一定時間内に行う必要があります。一度ログアウトしてから再度ログインしてください。',
            'Security Restriction'
          );
        } else {
          await showDialog('Googleアカウントの紐づけに失敗しました。\n\n' + error.code, 'Error');
        }
      } else if (error instanceof Error && error.message.includes('closed-by-user')) {
        // ユーザーがキャンセルした場合は何もしない
      } else {
        await showDialog(
          'Googleアカウントの紐づけに失敗しました。\n\n' + (error instanceof Error ? error.message : 'Unknown error'),
          'Error'
        );
      }
    }
  };

  // Appleアカウントを紐づけ
  const handleLinkApple = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSystemMessage('ユーザーがログインしていません。');
      return;
    }
    try {
      if (Capacitor.isNativePlatform() && FirebaseAuthentication) {
        const result = await FirebaseAuthentication.signInWithApple();
        if (!result.credential) {
          await showDialog('Appleログインのcredentialが取得できませんでした。', 'Error');
          return;
        }
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({ idToken: result.credential.idToken, rawNonce: result.credential.nonce });
        await linkWithCredential(user, credential);
      } else if (isElectron) {
        const oauthCredential = await window.electron!.openOAuthURL(
          `https://${import.meta.env.VITE_ELECTRON_AUTH_DOMAIN}/auth/apple`
        );
        const credential = OAuthProvider.credentialFromJSON(oauthCredential);
        await linkWithCredential(user, credential);
      } else {
        const provider = new OAuthProvider('apple.com');
        await linkWithPopup(user, provider);
      }
      await showDialog('Appleアカウントを紐づけました。', 'Account Linked');
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/provider-already-linked') {
          await showDialog('Appleアカウントを紐づけました。', 'Account Linked');
        } else if (error.code === 'auth/credential-already-in-use') {
          await showDialog(
            'このAppleアカウントは既に別のアカウントに紐づけられています。先にそちらのアカウントからAppleの紐づけを解除してください。',
            'Error'
          );
        } else if (error.code === 'auth/requires-recent-login') {
          await showDialog(
            'セキュリティの制限により、アカウントの紐づけはログインから一定時間内に行う必要があります。一度ログアウトしてから再度ログインしてください。',
            'Security Restriction'
          );
        } else {
          await showDialog('Appleアカウントの紐づけに失敗しました。\n\n' + error.code, 'Error');
        }
      } else if (error instanceof Error && error.message.includes('closed-by-user')) {
        // ユーザーがキャンセルした場合は何もしない
      } else {
        await showDialog(
          'Appleアカウントの紐づけに失敗しました。\n\n' + (error instanceof Error ? error.message : 'Unknown error'),
          'Error'
        );
      }
    }
  };

  // メール/パスワード認証を紐づけ
  const handleLinkEmail = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSystemMessage('ユーザーがログインしていません。');
      return;
    }
    const emailResult = await showInputDialog(
      'アカウントに紐づけるメールアドレスを入力してください',
      'Link Email',
      'メールアドレス',
      '',
      false
    );
    if (emailResult === '') return;

    const passwordResult = await showInputDialog(
      'パスワードを設定してください（6文字以上）',
      'Link Email',
      'パスワード',
      '',
      true
    );
    if (passwordResult === '') return;

    try {
      const credential = EmailAuthProvider.credential(emailResult, passwordResult);
      await linkWithCredential(user, credential);
      await showDialog('メール/パスワード認証を紐づけました。', 'Account Linked');
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/provider-already-linked') {
          await showDialog('メール/パスワード認証を紐づけました。', 'Account Linked');
        } else if (error.code === 'auth/credential-already-in-use') {
          await showDialog('このメールアドレスは既に別のアカウントで使用されています。', 'Error');
        } else if (error.code === 'auth/requires-recent-login') {
          await showDialog(
            'セキュリティの制限により、アカウントの紐づけはログインから一定時間内に行う必要があります。一度ログアウトしてから再度ログインしてください。',
            'Security Restriction'
          );
        } else if (error.code === 'auth/weak-password') {
          await showDialog('パスワードが弱すぎます。6文字以上のパスワードを設定してください。', 'Error');
        } else if (error.code === 'auth/email-already-in-use') {
          await showDialog('このメールアドレスは既に別のアカウントで使用されています。', 'Error');
        } else {
          await showDialog('メール/パスワード認証の紐づけに失敗しました。\n\n' + error.code, 'Error');
        }
      } else {
        await showDialog(
          'メール/パスワード認証の紐づけに失敗しました。\n\n' + (error instanceof Error ? error.message : 'Unknown error'),
          'Error'
        );
      }
    }
  };

  // プロバイダーの紐づけを解除
  const handleUnlinkProvider = async (providerId: string) => {
    const user = auth.currentUser;
    if (!user) {
      setSystemMessage('ユーザーがログインしていません。');
      return;
    }
    // 最後の認証方法は解除できない
    if (user.providerData.length <= 1) {
      await showDialog(
        '最後のログイン方法を解除することはできません。先に別のログイン方法を紐づけてから解除してください。',
        'Error'
      );
      return;
    }
    const providerName =
      providerId === 'google.com' ? 'Google' : providerId === 'apple.com' ? 'Apple' : 'メール/パスワード';
    const confirmed = await showDialog(`${providerName}の紐づけを解除しますか？`, 'Confirm', true);
    if (!confirmed) return;

    try {
      await unlink(user, providerId);
      await user.reload();
      await showDialog(`${providerName}の紐づけを解除しました。`, 'Unlinked');
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/no-such-provider') {
          await showDialog('このプロバイダーは紐づけられていません。', 'Error');
        } else if (error.code === 'auth/requires-recent-login') {
          await showDialog(
            'セキュリティの制限により、紐づけの解除はログインから一定時間内に行う必要があります。一度ログアウトしてから再度ログインしてください。',
            'Security Restriction'
          );
        } else {
          await showDialog('紐づけの解除に失敗しました。\n\n' + error.code, 'Error');
        }
      } else {
        await showDialog(
          '紐づけの解除に失敗しました。\n\n' + (error instanceof Error ? error.message : 'Unknown error'),
          'Error'
        );
      }
    }
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
        setItemsTreeId(null);
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

      //IndexedDBのデータを削除
      await idbService.deleteAllDataFromIdb();

      // ユーザーを削除
      user
        .delete()
        .then(async () => {
          await handleLogout();
          setSystemMessage('アカウントが削除されました。');
          if (isLoading) setIsLoading(false);
        })
        .catch(async (error) => {
          await handleLogout();
          if (error instanceof FirebaseError && error.code === 'auth/requires-recent-login') {
            setSystemMessage('セキュリティの制限により、アカウントの削除はユーザー自身のログインから一定時間内に行う必要があります。再度ログインし、アカウント削除を完了してください。');
          } else if (error instanceof Error) {
            setSystemMessage('アカウントの削除中にエラーが発生しました。管理者に連絡してください。 : \n\n' + error.message);
          } else {
            setSystemMessage('アカウントの削除中にエラーが発生しました。管理者に連絡してください。 : 不明なエラー');
          }
          if (isLoading) setIsLoading(false);
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
    handleChangeEmail,
    handleLogout,
    handleDeleteAccount,
    getLinkedProviders,
    handleLinkGoogle,
    handleLinkApple,
    handleLinkEmail,
    handleUnlinkProvider,
  };
};
