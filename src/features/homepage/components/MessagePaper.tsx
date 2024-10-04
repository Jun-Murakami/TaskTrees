import { useState, useEffect } from 'react';
import { Paper, Typography, Stack, Button, Divider } from '@mui/material';
import { useAppStateStore } from '@/store/appStateStore';

const isElectron = navigator.userAgent.indexOf('Electron') >= 0;

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
      // @ts-expect-error ElectronAPI
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
      {isWeb && (
        <>
          <Paper>
            <Typography variant='body2' sx={{ textAlign: 'left', p: 2 }} gutterBottom>
              2024.7.5 タイマー機能を追加しました。
              <br />
              <br />
              2024.4.15 クイックメモ機能を追加しました。
              <br />
              <br />
              2024.04.11 <a href='https://apps.apple.com/jp/app/tasktrees/id6482979857'>iOS版アプリ</a>を公開しました。
            </Typography>
          </Paper>
          <Button
            href='https://jun-murakami.web.app/#tasktrees'
            size='small'
            variant='outlined'
            sx={{ width: '100%', maxWidth: '90vw', mt: 2 }}
          >
            PC/スマホ版アプリのダウンロード
          </Button>
        </>
      )}
      {isElectron && (
        <Paper sx={{ maxWidth: 400, margin: 'auto', marginTop: 4 }}>
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
