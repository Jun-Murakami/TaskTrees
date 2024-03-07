import { Typography, Stack, Button } from '@mui/material';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import AppleIcon from '@mui/icons-material/Apple';
import ReplyIcon from '@mui/icons-material/Reply';

export function Download() {
  return (
    <>
      <Typography variant='h3' sx={{ margin: 10 }}>
        <img
          src='/TaskTrees.svg'
          alt='Task Tree'
          style={{ width: '35px', height: '35px', marginTop: '30px', marginRight: '10px' }}
        />
        TaskTrees
      </Typography>
      <Typography variant='h5' sx={{ mt: 1, mb: 0 }}>
        デスクトップアプリのダウンロード
      </Typography>
      <Typography variant='h6' sx={{ mt: 0, mb: 8 }}>
        version 1.0.0
      </Typography>
      <Stack spacing={3} sx={{ width: '350px', maxWidth: '350px', marginX: 'auto', marginY: 6 }}>
        <Button
          sx={{ textTransform: 'none' }}
          variant={'contained'}
          startIcon={<MicrosoftIcon />}
          component='a'
          href='/TaskTreesSetup.exe'
          download
        >
          Windows
        </Button>
        <Button
          sx={{ textTransform: 'none' }}
          variant={'contained'}
          startIcon={<AppleIcon />}
          component='a'
          href='/TaskTreesSetup.exe'
          download
        >
          MacOS (Apple Silicon)
        </Button>
        <Button
          sx={{ textTransform: 'none' }}
          variant={'contained'}
          startIcon={<AppleIcon />}
          component='a'
          href='/TaskTreesSetup.exe'
          download
        >
          MacOS (Intel)
        </Button>
      </Stack>
      <Button
        sx={{ marginTop: 5 }}
        variant={'outlined'}
        startIcon={<ReplyIcon />}
        onClick={() => {
          window.location.href = '/';
        }}
      >
        アプリのトップに戻る
      </Button>
    </>
  );
}
