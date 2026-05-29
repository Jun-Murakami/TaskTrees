import { describe, it, expect } from 'vitest';
import { getSyncStatus } from '@/utils/syncStatus';

describe('getSyncStatus', () => {
  const base = {
    isLoggedIn: true,
    isOffline: false,
    isConnectedDb: false,
    isLoading: false,
    isSyncing: false,
  };

  it('shows "syncing" during the initial sync even though isConnectedDb is still false', () => {
    // Reproduces the reported bug: at startup the `.info/connected` listener has
    // not reported yet, so isConnectedDb=false, while isLoading=true.
    expect(getSyncStatus({ ...base, isConnectedDb: false, isLoading: true })).toBe('syncing');
  });

  it('shows "syncing" while a foreground sync pass is running', () => {
    expect(getSyncStatus({ ...base, isConnectedDb: true, isSyncing: true })).toBe('syncing');
  });

  it('shows "offline" only when idle and the connection is confirmed down', () => {
    expect(getSyncStatus({ ...base, isConnectedDb: false, isLoading: false, isSyncing: false })).toBe('offline');
  });

  it('hides the indicator once connected and idle', () => {
    expect(getSyncStatus({ ...base, isConnectedDb: true })).toBe('hidden');
  });

  it('prefers "syncing" over "offline" when both a sync is active and connection is unknown', () => {
    expect(getSyncStatus({ ...base, isConnectedDb: false, isLoading: true })).toBe('syncing');
  });

  it('hides the indicator when not logged in', () => {
    expect(getSyncStatus({ ...base, isLoggedIn: false, isConnectedDb: false })).toBe('hidden');
  });

  it('hides the indicator in explicit offline mode (handled elsewhere)', () => {
    expect(getSyncStatus({ ...base, isOffline: true, isConnectedDb: false })).toBe('hidden');
  });
});
