import { Box, Typography, Button, useTheme } from '@mui/material';
import { TaskTreeLogoIcon } from '@/features/common/TaskTreesLogo';
import ReplyIcon from '@mui/icons-material/Reply';
import SettingsIcon from '@mui/icons-material/Settings';

export const DeleteAccount = () => {
  const theme = useTheme();
  return (
    <Box sx={{ textAlign: 'center', p: 2 }}>
      <Typography sx={{ mt: 5, marginBottom: 0, justifyContent: 'center', alignItems: 'center', display: 'flex' }} variant='h3'>
        <TaskTreeLogoIcon sx={{ width: '35px', height: '35px', marginRight: '10px', color: theme.palette.primary.main }} />
        TaskTrees
      </Typography>
      <Typography variant='h5' sx={{ marginY: 5 }}>
        アカウントの削除について
      </Typography>
      <Box sx={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
        <Typography variant='body1' sx={{ textAlign: 'left' }}>
          アカウントの削除は、ログイン後の
          <Button variant='outlined' startIcon={<SettingsIcon />} sx={{ mx: 1 }} size='small'>
            設定
          </Button>
          を押して表示されるメニューから「アカウント削除」を選択することで行うことができます。サーバに保存されたデータやメールアドレスなどのアカウント情報はすべて削除され、後から復元することはできません。
          <br />
          <br />
          アカウントの削除を行う前に、データのバックアップを取得することをお勧めします。
        </Typography>
      </Box>
      <Button
        variant={'outlined'}
        startIcon={<ReplyIcon />}
        onClick={() => {
          window.location.href = '/';
        }}
        sx={{ my: 10 }}
      >
        アプリのトップに戻る
      </Button>
    </Box>
  );
};
