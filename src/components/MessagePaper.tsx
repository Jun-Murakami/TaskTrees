import { Paper, Typography, Stack, Button } from '@mui/material';

export const MessagePaper = () => {
  return (
    <Stack sx={{ maxWidth: 300, margin: 'auto', marginTop: 4 }}>
      <Paper>
        <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
          2024.03.10 ファイルの添付機能を追加しました。タスクにファイルをドロップして添付できます。（25MBまで）
          <br />
          <br />
          2024.03.08 デスクトップ版アプリを正式リリースしました。（Windows,MacOS）
          <br />
          <br />
          １ツリーのシンプルな個人用バージョンは<a href='https://tasktree-fb.web.app/'>こちら</a>。
          ツリーデータは相互に移行可能です。
        </Typography>
      </Paper>
      <Button href='/download' size='small' variant='outlined' sx={{ maxWidth: 300, mt: 2 }}>
        デスクトップアプリのダウンロード
      </Button>{' '}
      <Typography variant='caption' sx={{ width: '100%', minWidth: '100%', mt: 1, textAlign: 'center' }}>
        <a href='mailto:app@bucketrelay.com' target='_blank' rel='noreferrer'>
          ©{new Date().getFullYear()} Jun Murakami
        </a>{' '}
        |{' '}
        <a href='https://github.com/Jun-Murakami/TaskTrees' target='_blank' rel='noreferrer'>
          GitHub
        </a>{' '}
        | <a href='/privacy-policy'>Privacy policy</a>
      </Typography>
    </Stack>
  );
};
