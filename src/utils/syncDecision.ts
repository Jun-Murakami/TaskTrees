import { UniqueIdentifier } from '@dnd-kit/core';

/**
 * Cross-device sync decisions.
 *
 * Each device stamps its writes to `users/{uid}/timestamp` and
 * `trees/{treeId}/timestamp` with its own `Date.now()`. Wall clocks on two
 * devices are NOT synchronized, so these timestamps do not form a monotonic
 * logical clock across devices: a device whose clock runs ahead writes a high
 * value, and a second device that edits *later* on a slower clock writes a
 * *lower* value.
 *
 * Comparing those values with `<=` / `>` (the original inline logic in
 * `useObserve.ts`) makes a device with a fast clock treat genuinely-newer
 * remote edits as stale and skip pulling them. The stale local copy is then
 * pushed back to the server on the next save, silently destroying the remote
 * edit. See `syncDecision.test.ts` for the full scenario.
 *
 * The functions below decide what to reconcile without trusting the *ordering*
 * of wall-clock timestamps. They only ask "is this the same value we already
 * have?" — equality is safe, because our own writes keep the local and server
 * timestamps in lockstep — and reconcile on any difference.
 */

/**
 * Whether an incoming `users/{uid}/timestamp` snapshot warrants a
 * reconciliation pass.
 *
 * Skip only when there is genuinely nothing to do:
 *  - no server timestamp at all,
 *  - the write was our own echo (same clientId), or
 *  - the value is exactly the one we already processed (`serverTimestamp ===
 *    localTimestamp`).
 *
 * Crucially we do NOT skip when `serverTimestamp < localTimestamp`: under clock
 * skew that case represents an unseen edit from another device, not a stale one.
 */
export function shouldProcessServerSnapshot(params: {
  serverTimestamp: number | null | undefined;
  localTimestamp: number;
  remoteClientId: string | null;
  localClientId: string;
}): boolean {
  const { serverTimestamp, localTimestamp, remoteClientId, localClientId } = params;
  if (!serverTimestamp) return false;
  if (remoteClientId && remoteClientId === localClientId) return false;
  return serverTimestamp !== localTimestamp;
}

/**
 * Whether a tree's server-side state should be pulled/merged into the local
 * copy during a sync pass.
 *
 * Compares the server tree timestamp against the timestamp we have stored
 * locally for that same tree. Our own writes set both to the same value, so
 * equality means "in sync"; any difference means another device wrote the tree
 * and we must reconcile — regardless of which value is numerically larger.
 *
 * A missing local timestamp (we have never seen this tree) also triggers a pull.
 */
export function shouldPullTree(params: {
  serverTreeTimestamp: number | null | undefined;
  localTreeTimestamp: number | null | undefined;
}): boolean {
  const { serverTreeTimestamp, localTreeTimestamp } = params;
  if (!serverTreeTimestamp) return false;
  return serverTreeTimestamp !== localTreeTimestamp;
}

/**
 * Convenience helper: from the server tree timestamp and a map of locally-known
 * per-tree timestamps, decide whether to pull.
 */
export function shouldPullTreeById(
  treeId: UniqueIdentifier,
  serverTreeTimestamp: number | null | undefined,
  localTreeTimestamps: Record<string, number>
): boolean {
  return shouldPullTree({
    serverTreeTimestamp,
    localTreeTimestamp: localTreeTimestamps[String(treeId)],
  });
}
