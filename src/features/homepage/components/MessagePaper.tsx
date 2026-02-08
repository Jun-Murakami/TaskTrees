import { useState, useEffect, useMemo } from 'react';
import { Paper, Typography, Stack, Button, Divider, Box } from '@mui/material';
import { useAppStateStore } from '@/store/appStateStore';

const isElectron = navigator.userAgent.includes('Electron');

const updateHistory = [
  {
    date: '2026.02.08',
    content:
      '１．オフライン時や、同期中でも編集できるようになりました。\n' +
      '２．ログイン後に認証方法の追加、解除ができるようになりました。\n' +
      '３．新規ツリーを作成時に、空のタスクを１つ自動で作るようにしました。\n' +
      '４．macOS版でコマンド＋Aで全選択ができるようになりました。\n' +
      '５．クイックメモを編集してアプリをすぐに終了すると、編集が保存されないことがある問題を修正しました\n' +
      '６．その他、細かいバグの修正とパフォーマンスの改善を行いました。',
  },
  {
    date: '2025.05.18',
    content: 'クイックメモをドッキング/切り離しできるようにしました。',
  },
  {
    date: '2024.10.05',
    content: 'アーカイブ機能を追加しました。',
  },
];

export const MessagePaper = () => {
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn); // ログイン状態

  const currentUrl = window.location.href;
  const isWeb =
    currentUrl.startsWith('http://localhost:') ||
    currentUrl.startsWith('https://tasktree-s.web.app') ||
    currentUrl.startsWith('https://tasktrees-fb.web.app');

  // アプリバージョン情報の取得
  useEffect(() => {
    if (!isElectron) return;

    // 現在のアプリバージョンを取得
    const fetchCurrentVersion = async () => {
      const version = await window.electron!.getAppVersion();
      setCurrentVersion(version);
    };

    // 最新バージョン情報を取得
    const fetchLatestVersion = async () => {
      try {
        const repoUrl = 'https://api.github.com/repos/Jun-Murakami/TaskTrees/releases/latest';
        const response = await fetch(repoUrl);
        const data = await response.json();
        if (!data) {
          console.error('データが見つかりません');
        }
        setLatestVersion(data.tag_name.replace('v', ''));
        setUpdateMessage(data.body);
      } catch (error) {
        setLatestVersion('※バージョン情報の取得に失敗しました。' + error);
      }
    };

    fetchCurrentVersion();
    fetchLatestVersion();
  }, [isLoggedIn]);

  const isNewVersionAvailable = useMemo(() => {
    if (!isElectron || !currentVersion || !latestVersion) return false;
    const currentVersionArray = currentVersion.split('.').map((v) => parseInt(v));
    const latestVersionArray = latestVersion.split('.').map((v) => parseInt(v));
    if (currentVersionArray[0] < latestVersionArray[0]) return true;
    if (currentVersionArray[0] > latestVersionArray[0]) return false;
    if (currentVersionArray[1] < latestVersionArray[1]) return true;
    if (currentVersionArray[1] > latestVersionArray[1]) return false;
    return currentVersionArray[2] < latestVersionArray[2];
  }, [currentVersion, latestVersion]);

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
            href='https://jun-murakami.web.app/#tasktrees'
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
            ver{currentVersion}
          </Typography>
          {isNewVersionAvailable ? (
            <>
              <Divider />
              <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
                {`最新バージョン: ${latestVersion} が利用可能です。`}
                <br />
                <a href='https://jun-murakami.web.app/#tasktrees' target='_blank' rel='noreferrer'>
                  ダウンロード
                </a>
                <br />
                <br />＞ {updateMessage}
              </Typography>
            </>
          ) : (
            <>
              <Divider />
              <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
                最新バージョン: {latestVersion}
                <br />
                {!latestVersion.includes('※バージョン情報の取得に失敗しました。') && 'お使いのバージョンは最新です。'}
              </Typography>
            </>
          )}
        </Paper>
      )}
      <Typography variant='caption' sx={{ width: '100%', minWidth: '100%', mt: 1, textAlign: 'center' }}>
        <a href='https://jun-murakami.web.app/' target='_blank' rel='noreferrer'>
          ©{new Date().getFullYear()} Jun Murakami
        </a>{' '}
        |{' '}
        <a href='https://github.com/Jun-Murakami/TaskTrees' target='_blank' rel='noreferrer'>
          GitHub
        </a>{' '}
        |{' '}
        <a href='https://jun-murakami.web.app/privacy-policy-tasktrees' target='_blank' rel='noreferrer'>
          Privacy policy
        </a>
      </Typography>
    </Stack>
  );
};
