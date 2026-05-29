/**
 * Decides which connection/sync indicator to show in the UI.
 *
 * The previous inline logic in `MenuSettings.tsx` was:
 *   showOffline = isLoggedIn && !isOffline && !isConnectedDb
 *   showSyncing = isLoggedIn && isLoading && !showOffline
 *
 * `isConnectedDb` starts as `false` and only becomes `true` once the Firebase
 * `.info/connected` listener reports in. During the initial sync (which fetches
 * existing backend data) that listener had not reported yet, so `isConnectedDb`
 * was `false`, `showOffline` won, and the UI showed "オフライン" the whole time
 * even though the app was online and actively syncing.
 *
 * The correct precedence is: if we are actively syncing/loading, show "同期中";
 * "オフライン" should only appear when we are genuinely idle AND the DB
 * connection is known to be down. An ongoing sync is itself proof we are not
 * offline.
 */
export type SyncStatus = 'hidden' | 'offline' | 'syncing';

export function getSyncStatus(params: {
  isLoggedIn: boolean;
  isOffline: boolean;
  isConnectedDb: boolean;
  isLoading: boolean;
  isSyncing: boolean;
}): SyncStatus {
  const { isLoggedIn, isOffline, isConnectedDb, isLoading, isSyncing } = params;

  // Not logged in, or running in explicit offline mode: no indicator here.
  if (!isLoggedIn || isOffline) {
    return 'hidden';
  }

  // Active sync/load takes precedence — being able to sync means we are online.
  if (isLoading || isSyncing) {
    return 'syncing';
  }

  // Idle and the DB connection is confirmed down.
  if (!isConnectedDb) {
    return 'offline';
  }

  return 'hidden';
}
