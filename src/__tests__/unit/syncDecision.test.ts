import { describe, it, expect } from 'vitest';
import {
  shouldProcessServerSnapshot,
  shouldPullTree,
  shouldPullTreeById,
} from '@/utils/syncDecision';

/**
 * Reproduces the cross-device data-loss bug:
 *
 *  1. Browser (device A) edits a tree. Both `users/{uid}/timestamp` and
 *     `trees/{treeId}/timestamp` are written with the browser device's
 *     `Date.now()`.
 *  2. The browser device's wall clock happens to run *behind* the Electron
 *     device's clock (the two machines are not time-synced). So the value the
 *     browser writes is numerically *smaller* than the value the Electron
 *     device last wrote, even though the browser edit happened later in real
 *     time.
 *  3. The Electron app — closed for a while, holding a higher `localTimestamp`
 *     in IndexedDB — reopens. Its sync observer compares the server timestamp
 *     against its own and, because server < local, decides the remote state is
 *     "stale" and skips pulling it.
 *  4. The stale local copy then overwrites the server on the next save, and the
 *     browser's edit is gone.
 *
 * The fix must base the decision on whether the value actually differs from
 * what we already have (a foreign write), NOT on which wall-clock value is
 * larger.
 */
describe('syncDecision — cross-device clock skew', () => {
  const ELECTRON = 'electron-client';
  const BROWSER = 'browser-client';

  // Electron last synced/wrote at 2000 (its clock is ahead).
  // Browser edited *later in real time* but its slower clock stamped 1500.
  const localTimestamp = 2000;
  const serverTimestamp = 1500;

  describe('shouldProcessServerSnapshot', () => {
    it('processes a foreign write even when its timestamp is lower (clock skew)', () => {
      expect(
        shouldProcessServerSnapshot({
          serverTimestamp,
          localTimestamp,
          remoteClientId: BROWSER,
          localClientId: ELECTRON,
        })
      ).toBe(true);
    });

    it('skips our own echo regardless of timestamp', () => {
      expect(
        shouldProcessServerSnapshot({
          serverTimestamp: 3000,
          localTimestamp,
          remoteClientId: ELECTRON,
          localClientId: ELECTRON,
        })
      ).toBe(false);
    });

    it('skips when the server value is exactly the one already processed', () => {
      expect(
        shouldProcessServerSnapshot({
          serverTimestamp: 2000,
          localTimestamp: 2000,
          remoteClientId: BROWSER,
          localClientId: ELECTRON,
        })
      ).toBe(false);
    });

    it('skips when there is no server timestamp', () => {
      expect(
        shouldProcessServerSnapshot({
          serverTimestamp: null,
          localTimestamp,
          remoteClientId: BROWSER,
          localClientId: ELECTRON,
        })
      ).toBe(false);
    });

    it('processes a normal forward update (server newer)', () => {
      expect(
        shouldProcessServerSnapshot({
          serverTimestamp: 5000,
          localTimestamp: 2000,
          remoteClientId: BROWSER,
          localClientId: ELECTRON,
        })
      ).toBe(true);
    });
  });

  describe('shouldPullTree', () => {
    it('pulls a tree whose server timestamp differs from the local copy, even if lower', () => {
      // Local IDB still holds the tree timestamp from the Electron device's last
      // session (2000); the browser overwrote the server tree with 1500.
      expect(
        shouldPullTree({
          serverTreeTimestamp: 1500,
          localTreeTimestamp: 2000,
        })
      ).toBe(true);
    });

    it('does not pull when the server tree timestamp matches the local one', () => {
      expect(
        shouldPullTree({
          serverTreeTimestamp: 2000,
          localTreeTimestamp: 2000,
        })
      ).toBe(false);
    });

    it('pulls a tree we have never seen locally', () => {
      expect(
        shouldPullTree({
          serverTreeTimestamp: 1500,
          localTreeTimestamp: undefined,
        })
      ).toBe(true);
    });

    it('pulls a normal forward update', () => {
      expect(
        shouldPullTree({
          serverTreeTimestamp: 3000,
          localTreeTimestamp: 2000,
        })
      ).toBe(true);
    });
  });

  describe('shouldPullTreeById', () => {
    it('resolves the local timestamp from the per-tree map (skew-safe)', () => {
      const localTreeTimestamps = { treeA: 2000 };
      expect(shouldPullTreeById('treeA', 1500, localTreeTimestamps)).toBe(true);
      expect(shouldPullTreeById('treeA', 2000, localTreeTimestamps)).toBe(false);
      expect(shouldPullTreeById('treeB', 1500, localTreeTimestamps)).toBe(true);
    });
  });
});
