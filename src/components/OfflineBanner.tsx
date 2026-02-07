import { Alert, Collapse } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useAppStateStore } from '@/store/appStateStore';

export const OfflineBanner: React.FC<{ hasConflict?: boolean }> = ({ hasConflict = false }) => {
  const isConnectedDb = useAppStateStore((s) => s.isConnectedDb);
  const isOffline = useAppStateStore((s) => s.isOffline);
  const isLoggedIn = useAppStateStore((s) => s.isLoggedIn);

  const showBanner = isLoggedIn && !isOffline && !isConnectedDb;

  return (
    <>
      <Collapse in={showBanner}>
        <Alert
          severity='warning'
          variant='filled'
          icon={<WifiOffIcon />}
          sx={{
            borderRadius: 0,
            py: 0,
            fontSize: '0.85rem',
          }}
        >
          オフライン — 編集内容はローカルに保存されます
        </Alert>
      </Collapse>
      <Collapse in={showBanner && hasConflict}>
        <Alert
          severity='error'
          variant='filled'
          sx={{
            borderRadius: 0,
            py: 0,
            fontSize: '0.85rem',
          }}
        >
          サーバーとの変更の競合が検出されました。ローカルの変更を保持しています。
        </Alert>
      </Collapse>
    </>
  );
};
