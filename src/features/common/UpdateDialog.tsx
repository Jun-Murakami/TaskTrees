import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { Close, Download, OpenInNew, Refresh } from '@mui/icons-material';
import type { PlatformInfo, UpdateDownloadProgress } from '@/types/electron';
import type { ReleaseAsset } from '@/hooks/useCheckForUpdates';

const ReactMarkdown = lazy(() => import('react-markdown'));

// AppImage は自己完結バイナリのためアプリ内入れ替え更新ができない。
// ダウンロードページに誘導する。
const APPIMAGE_DOWNLOAD_PAGE_URL = 'https://jun-murakami.web.app/apps/tasktrees';

type DownloadState = 'idle' | 'downloading' | 'installing' | 'error';

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
  latestVersion: string;
  releaseBody: string;
  releaseAssets: ReleaseAsset[];
  releasePageUrl: string;
  platform: PlatformInfo | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${units[i]}`;
};

/**
 * プラットフォームに対応するアセットを選ぶ。
 * - win32 : *-setup_win_*.exe （NSIS インストーラ）
 * - darwin: *_mac_*.dmg
 * - linux(deb) : *_linux_amd64.deb
 * - linux(AppImage 起動時) は呼び出し側で外部リンクに切り替えるため null を返す
 */
const findAssetForPlatform = (
  assets: ReleaseAsset[],
  platform: PlatformInfo,
): ReleaseAsset | null => {
  const { osInfo, isAppImage } = platform;
  if (osInfo === 'win32') {
    return assets.find((a) => /setup_win/i.test(a.name) && a.name.endsWith('.exe')) ?? null;
  }
  if (osInfo === 'darwin') {
    return assets.find((a) => a.name.endsWith('.dmg')) ?? null;
  }
  // linux
  if (isAppImage) {
    // AppImage は in-app 更新非対応 → 外部リンクへ
    return null;
  }
  return assets.find((a) => a.name.endsWith('.deb')) ?? null;
};

export const UpdateDialog = ({
  open,
  onClose,
  latestVersion,
  releaseBody,
  releaseAssets,
  releasePageUrl,
  platform,
}: UpdateDialogProps) => {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState<UpdateDownloadProgress>({
    receivedBytes: 0,
    totalBytes: 0,
    percent: 0,
  });
  const [errorMessage, setErrorMessage] = useState('');

  const isLinuxAppImage = platform?.osInfo === 'linux' && platform?.isAppImage;
  const asset = platform ? findAssetForPlatform(releaseAssets, platform) : null;
  const externalPageUrl = isLinuxAppImage ? APPIMAGE_DOWNLOAD_PAGE_URL : releasePageUrl;
  const isBusy = downloadState === 'downloading' || downloadState === 'installing';
  const canDownload = downloadState === 'idle' || downloadState === 'error';

  // 進捗イベント購読
  useEffect(() => {
    if (!open) return;
    window.electron?.onUpdateDownloadProgress((p) => setProgress(p));
    return () => {
      window.electron?.removeUpdateDownloadProgressListener();
    };
  }, [open]);

  const handleClose = useCallback(() => {
    if (isBusy) return; // ダウンロード中・インストール中はクローズ不可
    onClose();
    setDownloadState('idle');
    setProgress({ receivedBytes: 0, totalBytes: 0, percent: 0 });
    setErrorMessage('');
  }, [onClose, isBusy]);

  const handleDownload = useCallback(async () => {
    if (!asset) return;
    setDownloadState('downloading');
    setProgress({ receivedBytes: 0, totalBytes: 0, percent: 0 });
    setErrorMessage('');

    const result = await window.electron!.startUpdateDownload(asset.browserDownloadUrl);
    if (result.success) {
      setDownloadState('installing');
    } else if (result.error === 'cancelled') {
      setDownloadState('idle');
    } else {
      setDownloadState('error');
      // セキュリティ検証の失敗は、利用者に意図が伝わる日本語メッセージにする
      const friendlyError =
        result.error === 'checksum-mismatch'
          ? 'ダウンロードしたファイルの整合性チェック（SHA-256）に失敗しました。安全のため更新を中止しました。'
          : result.error === 'signature-invalid'
            ? 'ダウンロードしたファイルのコード署名の検証に失敗しました。安全のため更新を中止しました。'
            : result.error === 'invalid-download-url'
              ? '更新ファイルの配布元が許可されていません。安全のため更新を中止しました。'
              : (result.error ?? 'Unknown error');
      setErrorMessage(friendlyError);
    }
  }, [asset]);

  const handleCancelDownload = useCallback(() => {
    window.electron?.cancelUpdateDownload();
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (!externalPageUrl) return;
    window.electron?.openExternalLink(externalPageUrl);
  }, [externalPageUrl]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 1 }}>
        新しいバージョン v{latestVersion} が利用可能です
        <IconButton aria-label='close' onClick={handleClose} disabled={isBusy} size='small'>
          <Close fontSize='small' />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            maxHeight: 320,
            overflow: 'auto',
            '& img': { maxWidth: '100%' },
            '& a': { color: 'primary.main' },
            '& pre': { overflow: 'auto', bgcolor: 'action.hover', p: 1, borderRadius: 1 },
            '& code': { fontSize: '0.875em' },
          }}
        >
          {releaseBody ? (
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <ReactMarkdown>{releaseBody}</ReactMarkdown>
            </Suspense>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              リリースノートはありません。
            </Typography>
          )}
        </Box>

        {downloadState === 'downloading' && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant='body2'>ダウンロード中... {progress.percent}%</Typography>
              <Typography variant='body2' color='text.secondary'>
                {formatBytes(progress.receivedBytes)}
                {' / '}
                {progress.totalBytes > 0 ? formatBytes(progress.totalBytes) : '---'}
              </Typography>
            </Box>
            <LinearProgress variant='determinate' value={progress.percent} />
          </Box>
        )}

        {downloadState === 'installing' && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant='body2'>
              {platform?.osInfo === 'linux'
                ? 'ダウンロード先のフォルダを開いています...'
                : platform?.osInfo === 'darwin'
                  ? 'アプリを置き換えて再起動します...'
                  : 'インストーラを起動しています...'}
            </Typography>
          </Box>
        )}

        {downloadState === 'error' && (
          <Typography variant='body2' color='error' sx={{ mt: 2 }}>
            ダウンロードに失敗しました: {errorMessage}
          </Typography>
        )}

        {isLinuxAppImage && (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
            AppImage 版はアプリ内更新に対応していません。下のボタンからダウンロードページを開いてください。
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {asset ? (
          <>
            {downloadState === 'downloading' ? (
              <Button onClick={handleCancelDownload}>ダウンロードを中止</Button>
            ) : (
              <>
                <Button onClick={handleClose} disabled={isBusy}>
                  あとで
                </Button>
                {canDownload && (
                  <Button
                    onClick={handleDownload}
                    variant='contained'
                    startIcon={downloadState === 'error' ? <Refresh /> : <Download />}
                  >
                    {downloadState === 'error' ? '再試行' : 'ダウンロードしてインストール'}
                    {downloadState === 'idle' && asset.size > 0 && (
                      <Typography component='span' variant='caption' sx={{ ml: 1, opacity: 0.8 }}>
                        ({formatBytes(asset.size)})
                      </Typography>
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <Button onClick={handleClose}>閉じる</Button>
            <Button onClick={handleOpenExternal} variant='contained' startIcon={<OpenInNew />}>
              {isLinuxAppImage ? 'ダウンロードページを開く' : 'リリースページを開く'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
