import { Button, CircularProgress, Typography, Box } from '@mui/material';
import { DeleteForever } from '@mui/icons-material';
import { TaskTreesLogo } from '@/features/common/TaskTreesLogo';
import { ResponsiveDrawer } from '@/features/homepage/components/ResponsiveDrawer';
import { MessagePaper } from '@/features/homepage/components/MessagePaper';
import { TreeSettingsAccordion } from '@/features/homepage/components/TreeSettingsAccordion';
import { SortableTree } from '@/features/sortableTree/SortableTree';
import { QuickMemo } from '@/features/homepage/components/QuickMemo';
import { useAuth } from '@/features/homepage/hooks/useAuth';
import { Login } from '@/features/homepage/components/Login';
import { ArchiveList } from '@/features/homepage/components/ArchiveList';
import { Capacitor } from '@capacitor/core';

import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';

import { useElectron } from '@/hooks/useElectron';

export function HomePage() {
  const isLoading = useAppStateStore((state) => state.isLoading); // ローディング中の状態
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn); // ログイン状態
  const isWaitingForDelete = useAppStateStore((state) => state.isWaitingForDelete); // アカウント削除の確認状態
  const setIsWaitingForDelete = useAppStateStore((state) => state.setIsWaitingForDelete); // アカウント削除の確認状態を変更
  const isQuickMemoExpanded = useAppStateStore((state) => state.isQuickMemoExpanded); // クイックメモの展開状態
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const isShowArchive = useAppStateStore((state) => state.isShowArchive);

  // 認証状態の監視とログイン、ログアウトを行うカスタムフック
  const {
    handleGoogleLogin,
    handleAppleLogin,
    handleEmailLogin,
    handleSignup,
    handleResetPassword,
    handleChangeEmail,
    handleLogout,
    handleDeleteAccount,
  } = useAuth();

  const drawerWidth = 300;

  useElectron();

  return (
    <>
      {isLoggedIn ? (
        !isWaitingForDelete ? (
          // ログイン後のメイン画面
          <>
            <QuickMemo />
            <ResponsiveDrawer handleLogout={handleLogout} handleChangeEmail={handleChangeEmail} />
            <Box
              sx={{
                flexGrow: 1,
                maxWidth: '930px',
                px: '15px',
                mx: 'auto',
                height: '100dvh',
                '@media (max-width: 1546px)': {
                  ml: { xs: 'auto', sm: `${drawerWidth}px` },
                },
                pt: Capacitor.isNativePlatform() ? 'env(safe-area-inset-top)' : 0,
                pb: Capacitor.isNativePlatform() ? 'env(safe-area-inset-bottom)' : 0,
              }}
            >
              {isShowArchive ? (
                <ArchiveList />
              ) : (
                <>
                  {currentTree ? (
                    // ツリーがある場合
                    <>
                      <TreeSettingsAccordion />
                      <Box
                        sx={{
                          maxWidth: '900px',
                          width: '100%',
                          marginX: 'auto',
                          pt: { xs: '90px', sm: '138px' },
                          pb: isQuickMemoExpanded ? 65 : 20,
                        }}
                        id='tree-container'
                      >
                        <SortableTree collapsible indicator removable />
                      </Box>
                    </>
                  ) : (
                    // ツリーがない場合
                    <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Box>
                        <TaskTreesLogo />
                        <MessagePaper />
                      </Box>
                    </Box>
                  )}
                </>
              )}
              {isLoading && (
                // ローディング中
                <CircularProgress
                  sx={{
                    position: 'fixed',
                    display: 'block',
                    left: 'calc(50% - 20px)',
                    '@media (min-width: 1249px) and (max-width: 1546px)': {
                      left: { xs: 'calc(50% - 20px)', sm: '745px' },
                    },
                    '@media (max-width: 1249px)': {
                      left: { xs: 'calc(50% - 20px)', sm: 'calc((100vw - (100vw - 100%) - 300px) / 2 + 300px - 20px)' },
                    },
                    top: 'calc(50vh - 20px)',
                    zIndex: 1400,
                  }}
                />
              )}
            </Box>
          </>
        ) : (
          // アカウント削除の確認ダイアログ
          <Box
            sx={{
              textAlign: 'center',
              height: '100dvh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              p: 2,
            }}
          >
            <TaskTreesLogo />
            <Typography variant='body2' sx={{ marginY: 4 }}>
              アプリケーションのすべてのデータとアカウント情報が削除されます。
              <br />
              （複数メンバーで共有しているツリーは自分が編集メンバーから削除されます。）
              <br />
              この操作は取り消せません。削除を実行しますか？
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 400 }}>
              <Button
                onClick={async () => {
                  await handleDeleteAccount();
                }}
                variant={'contained'}
                startIcon={<DeleteForever />}
                color='error'
                sx={{ marginRight: 4 }}
              >
                削除する
              </Button>
              <Button onClick={() => setIsWaitingForDelete(false)} variant={'outlined'}>
                キャンセル
              </Button>
            </Box>
          </Box>
        )
      ) : (
        <Login
          handleEmailLogin={handleEmailLogin}
          handleSignup={handleSignup}
          handleGoogleLogin={handleGoogleLogin}
          handleAppleLogin={handleAppleLogin}
          handleResetPassword={handleResetPassword}
        />
      )}
    </>
  );
}
