import { useState, useEffect } from 'react';
import { Paper, Typography, Stack, Button, Divider, Box } from '@mui/material';
import { useAppStateStore } from '@/store/appStateStore';

const isElectron = navigator.userAgent.includes('Electron');

const updateHistory = [
  {
    date: '2025.01.02',
    content: 'アプリ休止時のデータ保存の問題を修正しました。',
  },
  {
    date: '2024.10.05',
    content: 'アーカイブ機能を追加しました。',
  },
  {
    date: '2024.07.05',
    content: 'タイマー機能を追加しました。',
  },
  {
    date: '2024.04.15',
    content: 'クイックメモ機能を追加しました。',
  },
];

export const MessagePaper = () => {
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);

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
      //@ts-expect-error Electron
      const version = await window.electron.getAppVersion();
      setCurrentVersion(version);
    };

    // 最新バージョン情報を取得
    const fetchLatestVersion = async () => {
      try {
        const repoUrl = 'https://api.github.com/repos/Jun-Murakami/TaskTrees-Electron/releases/latest';
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

  // 新しいバージョンがあるかどうかを判定
  useEffect(() => {
    if (!isElectron) return;

    if (currentVersion && latestVersion) {
      const currentVersionArray = currentVersion.split('.').map((v) => parseInt(v));
      const latestVersionArray = latestVersion.split('.').map((v) => parseInt(v));
      if (currentVersionArray[0] < latestVersionArray[0]) {
        setIsNewVersionAvailable(true);
      } else if (currentVersionArray[0] === latestVersionArray[0]) {
        if (currentVersionArray[1] < latestVersionArray[1]) {
          setIsNewVersionAvailable(true);
        } else if (currentVersionArray[1] === latestVersionArray[1]) {
          if (currentVersionArray[2] < latestVersionArray[2]) {
            setIsNewVersionAvailable(true);
          }
        }
      }
    }
  }, [currentVersion, latestVersion]);

  return (
    <Stack sx={{ width: '100%', maxWidth: 400, margin: 'auto', marginTop: 4 }}>
      {isWeb && !isElectron && (
        <>
          <Paper>
            <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
              <Stack spacing={1}>
                {updateHistory.map((update, index: number) => (
                  <Box key={index} sx={{ display: 'flex' }}>
                    <Box sx={{ minWidth: '85px' }}>{update.date}</Box>
                    <Box>{update.content}</Box>
                  </Box>
                ))}
              </Stack>
            </Typography>
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
        <a
          href={isElectron ? 'https://github.com/Jun-Murakami/TaskTrees-Electron' : 'https://github.com/Jun-Murakami/TaskTrees'}
          target='_blank'
          rel='noreferrer'
        >
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
