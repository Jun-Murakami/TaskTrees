import { useEffect, useState } from 'react';
import { Typography, Stack, Button, Box, Popper, Fade } from '@mui/material';
import MicrosoftIcon from '@mui/icons-material/Microsoft';
import AppleIcon from '@mui/icons-material/Apple';
import ReplyIcon from '@mui/icons-material/Reply';

export function Download() {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [version, setVersion] = useState(''); //publicルートのversion.jsonからバージョン番号を取得

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen((previousOpen) => !previousOpen);
  };

  const canBeOpen = open && Boolean(anchorEl);
  const id = canBeOpen ? 'transition-popper' : undefined;

  useEffect(() => {
    fetch('/version.json')
      .then((response) => response.json())
      .then((data) => setVersion(data.version));
  }, []);

  return (
    <Box sx={{ textAlign: 'center' }}>
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
        version {version}
      </Typography>
      <Stack spacing={3} sx={{ width: '350px', maxWidth: '350px', marginX: 'auto', marginY: 6 }}>
        <Button
          sx={{ textTransform: 'none' }}
          variant={'contained'}
          startIcon={<MicrosoftIcon />}
          component='a'
          href={`https://github.com/Jun-Murakami/TaskTrees-Electron/releases/download/v${version}/TaskTrees-${version}-setup_win_x64.exe`}
          download
        >
          Windows
        </Button>
        <Button
          sx={{ textTransform: 'none' }}
          variant={'contained'}
          startIcon={<AppleIcon />}
          component='a'
          href={`https://github.com/Jun-Murakami/TaskTrees-Electron/releases/download/v${version}/TaskTrees-${version}_mac_arm64.dmg`}
          download
        >
          MacOS (Apple Silicon)
        </Button>
        <Button
          sx={{ textTransform: 'none' }}
          variant={'contained'}
          startIcon={<AppleIcon />}
          component='a'
          href={`https://github.com/Jun-Murakami/TaskTrees-Electron/releases/download/v${version}/TaskTrees-${version}_mac_x64.dmg`}
          download
        >
          MacOS (Intel)
        </Button>
        <Button variant='text' size='small' sx={{ mt: 2 }} onMouseEnter={handleClick} onMouseLeave={handleClick}>
          ※インストール時のセキュリティ警告について
        </Button>
        <Popper id={id} open={open} anchorEl={anchorEl} transition placement='top'>
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={350}>
              <Box sx={{ border: 1, p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.95)', textAlign: 'center' }}>
                <img src='/InstallNoteWin.png' style={{ width: '800px', height: 'auto' }} />
                <Typography variant='body2'>
                  Windowsの場合、インストール時にセキュリティ警告が表示されます。
                  <br />
                  その際は「詳細情報」をクリックし、「実行」を選択してください。
                  <br />
                  <br />
                </Typography>
                <Typography variant='caption'>
                  ※プログラムが未署名であることによる警告です。ソースコードを公開しているので、
                  <br />
                  不安がある場合はご自身で確認の上ビルドしてください。(MacOS版は署名済み)
                </Typography>
              </Box>
            </Fade>
          )}
        </Popper>
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
    </Box>
  );
}
