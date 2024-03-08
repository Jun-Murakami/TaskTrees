import { Paper, Typography } from '@mui/material';

export const MessagePaper = () => {
  return (
    <>
      <Paper sx={{ maxWidth: 300, margin: 'auto', marginTop: 4 }}>
        <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
          2024.03.08 デスクトップアプリ版を正式リリースしました。(Windows, MacOS対応)
          <br />
          <a href='/download'>こちら</a>からダウンロードできます。
          <br />
          <br />
          １ツリーのシンプルな個人用バージョンは<a href='https://tasktree-fb.web.app/'>こちら</a>。
          ツリーデータは相互に移行可能です。
        </Typography>
      </Paper>
      <Typography variant='caption' sx={{ width: '100%', minWidth: '100%' }}>
        <a href='mailto:app@bucketrelay.com' target='_blank' rel='noreferrer'>
          ©{new Date().getFullYear()} Jun Murakami
        </a>{' '}
        |{' '}
        <a href='https://github.com/Jun-Murakami/TaskTrees' target='_blank' rel='noreferrer'>
          GitHub
        </a>{' '}
        | <a href='/privacy-policy'>Privacy policy</a>
      </Typography>
      <Typography variant='caption' sx={{ width: '100%' }}></Typography>
    </>
  );
};
