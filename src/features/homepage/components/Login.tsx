import { useState } from 'react';
import { Box, Button, CircularProgress, Divider, Stack, TextField, Typography, useTheme } from '@mui/material';
import { Google, Apple } from '@mui/icons-material';
import { TaskTreesLogo } from '@/features/common/TaskTreesLogo';
import { MessagePaper } from '@/features/homepage/components/MessagePaper';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeManagement } from '@/hooks/useTreeManagement';

interface LoginProps {
  handleEmailLogin: (email: string, password: string) => Promise<void>;
  handleSignup: (email: string, password: string) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleAppleLogin: () => Promise<void>;
  handleResetPassword: () => Promise<void>;
}

export const Login = ({
  handleEmailLogin,
  handleSignup,
  handleGoogleLogin,
  handleAppleLogin,
  handleResetPassword,
}: LoginProps) => {
  const [email, setEmail] = useState(''); // ログイン用メールアドレス
  const [password, setPassword] = useState(''); // ログイン用パスワード
  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsOffline = useAppStateStore((state) => state.setIsOffline);
  const setIsLoggedIn = useAppStateStore((state) => state.setIsLoggedIn);
  const systemMessage = useAppStateStore((state) => state.systemMessage);

  const { handleCreateOfflineTree } = useTreeManagement();
  const theme = useTheme();

  return (
    // ログイン前の画面
    <Box
      sx={{
        textAlign: 'center',
        maxWidth: 400,
        marginX: 'auto',
        height: '100vh',
        p: 4,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Box>
        <TaskTreesLogo />
        {isLoading ? (
          <CircularProgress sx={{ marginY: 4, display: 'block', marginX: 'auto' }} />
        ) : (
          <>
            <Stack spacing={2} sx={{ width: '100%', maxWidth: 400 }}>
              <TextField
                label='メールアドレス'
                variant='outlined'
                margin='normal'
                value={email}
                size='small'
                fullWidth
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label='パスワード'
                variant='outlined'
                margin='normal'
                type='password'
                value={password}
                size='small'
                fullWidth
                onChange={(e) => setPassword(e.target.value)}
              />
              <Box sx={{ mt: 4, width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  sx={{ width: '48%', left: 0 }}
                  variant='contained'
                  onClick={async () => await handleEmailLogin(email, password)}
                >
                  ログイン
                </Button>
                <Button
                  sx={{
                    width: '48%',
                    right: 0,
                    backgroundColor: 'rgba(128, 128, 128, 0.1)',
                    color: theme.palette.primary.main,
                  }}
                  variant='outlined'
                  onClick={async () => await handleSignup(email, password)}
                >
                  新規ユーザー登録
                </Button>
              </Box>
              <Divider>
                <Typography variant='caption'>または</Typography>
              </Divider>
              <Button
                onClick={async () => await handleGoogleLogin()}
                variant='contained'
                startIcon={<Google />}
                sx={{ textTransform: 'none' }}
              >
                Googleでログイン
              </Button>
              <Button
                onClick={async () => await handleAppleLogin()}
                variant='contained'
                startIcon={<Apple />}
                sx={{ textTransform: 'none' }}
              >
                Appleでログイン
              </Button>
              <Button
                onClick={async () => {
                  setIsOffline(true);
                  setIsLoggedIn(true);
                  await handleCreateOfflineTree();
                }}
                variant='contained'
                sx={{ textTransform: 'none' }}
              >
                オフラインモードで使用する
              </Button>
              <Button onClick={async () => await handleResetPassword()} variant='text' size='small'>
                <Typography variant='caption' sx={{ textDecoration: 'underline' }}>
                  ※ パスワードをお忘れですか？
                </Typography>
              </Button>
            </Stack>
          </>
        )}
        {systemMessage && (
          <Box
            sx={{
              backgroundColor: theme.palette.action.hover,
              borderRadius: 4,
              py: '10px',
              mx: 'auto',
              mt: 2,
              mb: 0,
              width: '100%',
            }}
          >
            <Typography variant='body2' sx={{ mx: 2, color: theme.palette.primary.main }}>
              {systemMessage}
            </Typography>
          </Box>
        )}
        <MessagePaper />
      </Box>
    </Box>
  );
};
