import { Paper, Typography, Stack, Button, Divider, Box, Link } from '@mui/material';
import { useUpdateStore } from '@/store/updateStore';

const isElectron = navigator.userAgent.includes('Electron');

const updateHistory = [
  {
    date: '2026.05.29',
    content:
      'Linux版（deb / AppImage）をリリースしました。Windows版でコード署名に対応しました。Windows / macOS / Linux(deb) でアプリ内アップデートに対応しました。',
  },
  {
    date: '2026.02.08',
    content:
      '１．オフライン時や、同期中でも編集できるようになりました。\n' +
      '２．ログイン後に認証方法の追加、解除ができるようになりました。\n' +
      '３．新規ツリーを作成時に、空のタスクを１つ自動で作るようにしました。\n' +
      '４．macOS版でコマンド＋Aで全選択ができるようになりました。\n' +
      '５．クイックメモを編集してアプリをすぐに終了すると、編集が保存されないことがある問題を修正しました\n'
  },
];

export const MessagePaper = () => {
  // アップデート情報は useElectron 内で一括チェックされ updateStore に保存される。
  // 表示するだけ。ダイアログ表示制御は HomePage 側。
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const hasChecked = useUpdateStore((s) => s.hasChecked);
  const setIsDialogOpen = useUpdateStore((s) => s.setIsDialogOpen);

  const currentUrl = window.location.href;
  const isWeb =
    currentUrl.startsWith('http://localhost:') ||
    currentUrl.startsWith('https://tasktree-s.web.app') ||
    currentUrl.startsWith('https://tasktrees-fb.web.app');

  return (
    <Stack sx={{ width: '100%', maxWidth: 400, margin: 'auto', marginTop: 4 }}>
      {isWeb && !isElectron && (
        <>
          <Paper>
            <Box sx={{ textAlign: 'left', p: 2, pb: 1 }}>
              <Stack spacing={1}>
                {updateHistory.map((update, index: number) => (
                  <Box key={index} sx={{ display: 'flex' }}>
                    <Typography variant='body2' sx={{ minWidth: '85px', flexShrink: 0 }}>{update.date}</Typography>
                    <Typography variant='body2'>{update.content}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Paper>
          <Button
            href='https://jun-murakami.web.app/apps/tasktrees'
            size='small'
            variant='outlined'
            sx={{ width: '100%', maxWidth: '90vw', mt: 2 }}
          >
            PC/スマートフォン版 アプリのダウンロード
          </Button>
        </>
      )}
      {isElectron && (
        <Paper sx={{ width: '100%', maxWidth: 400, margin: 'auto', marginTop: 4 }}>
          <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
            ver{currentVersion ?? ''}
          </Typography>
          {updateInfo ? (
            <>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Typography variant='body2' gutterBottom>
                  {`最新バージョン: ${updateInfo.latestVersion} が利用可能です。`}
                </Typography>
                <Button
                  size='small'
                  variant='contained'
                  sx={{ mt: 1 }}
                  onClick={() => setIsDialogOpen(true)}
                >
                  アップデート
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Divider />
              <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
                {hasChecked ? 'お使いのバージョンは最新です。' : ''}
              </Typography>
            </>
          )}
        </Paper>
      )}
      <Typography variant='caption' sx={{ width: '100%', minWidth: '100%', mt: 1, textAlign: 'center' }}>
        <Link href='https://jun-murakami.web.app/' target='_blank' rel='noreferrer' underline='hover'>
          ©{new Date().getFullYear()} Jun Murakami
        </Link>
        {' | '}
        <Link href='https://github.com/Jun-Murakami/TaskTrees' target='_blank' rel='noreferrer' underline='hover'>
          GitHub
        </Link>
        {' | '}
        <Link href='https://jun-murakami.web.app/privacy-policy-tasktrees' target='_blank' rel='noreferrer' underline='hover'>
          Privacy policy
        </Link>
      </Typography>
    </Stack>
  );
};
