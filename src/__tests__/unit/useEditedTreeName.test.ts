import { describe, it, expect } from 'vitest';

/**
 * useEditedTreeName の同期ロジックを純粋関数としてテストする。
 *
 * フックの核心ロジック:
 *   if (currentTreeName !== prevCurrentTreeName) {
 *     setPrevCurrentTreeName(currentTreeName);
 *     setEditedTreeName(currentTreeName);
 *   }
 *
 * このロジックを状態遷移関数として抽出しテストする。
 */

type SyncState = {
  editedTreeName: string | null;
  prevCurrentTreeName: string | null;
};

function applySyncLogic(state: SyncState, currentTreeName: string | null): SyncState {
  if (currentTreeName !== state.prevCurrentTreeName) {
    return {
      editedTreeName: currentTreeName,
      prevCurrentTreeName: currentTreeName,
    };
  }
  return state;
}

describe('useEditedTreeName sync logic', () => {
  it('initializes editedTreeName from currentTreeName', () => {
    const state: SyncState = { editedTreeName: 'ツリーA', prevCurrentTreeName: 'ツリーA' };
    const result = applySyncLogic(state, 'ツリーA');
    expect(result.editedTreeName).toBe('ツリーA');
  });

  it('syncs editedTreeName when currentTreeName changes', () => {
    const state: SyncState = { editedTreeName: 'ツリーA', prevCurrentTreeName: 'ツリーA' };
    const result = applySyncLogic(state, 'ツリーB');
    expect(result.editedTreeName).toBe('ツリーB');
    expect(result.prevCurrentTreeName).toBe('ツリーB');
  });

  it('does not overwrite user edits when currentTreeName has not changed', () => {
    const state: SyncState = { editedTreeName: 'ユーザー編集中', prevCurrentTreeName: 'ツリーA' };
    const result = applySyncLogic(state, 'ツリーA');
    expect(result.editedTreeName).toBe('ユーザー編集中');
  });

  it('handles null currentTreeName', () => {
    const state: SyncState = { editedTreeName: 'ツリーA', prevCurrentTreeName: 'ツリーA' };
    const result = applySyncLogic(state, null);
    expect(result.editedTreeName).toBeNull();
    expect(result.prevCurrentTreeName).toBeNull();
  });

  it('handles transition from null to a value', () => {
    const state: SyncState = { editedTreeName: null, prevCurrentTreeName: null };
    const result = applySyncLogic(state, '新しいツリー');
    expect(result.editedTreeName).toBe('新しいツリー');
  });

  describe('race condition: tree switch before name load (the bug scenario)', () => {
    it('OLD behavior: tracking currentTree causes stale name sync', () => {
      type OldSyncState = {
        editedTreeName: string | null;
        prevCurrentTree: string | null;
      };

      function applyOldSyncLogic(
        state: OldSyncState,
        currentTree: string | null,
        currentTreeName: string | null
      ): OldSyncState {
        if (currentTree !== state.prevCurrentTree) {
          return {
            editedTreeName: currentTreeName,
            prevCurrentTree: currentTree,
          };
        }
        return state;
      }

      const state: OldSyncState = { editedTreeName: 'ツリーA', prevCurrentTree: 'tree-a' };

      // currentTree changes to tree-b, but currentTreeName is still "ツリーA"
      const afterSwitch = applyOldSyncLogic(state, 'tree-b', 'ツリーA');
      expect(afterSwitch.editedTreeName).toBe('ツリーA');

      // currentTreeName finally updates to "ツリーB" but old code won't re-sync
      const afterNameLoad = applyOldSyncLogic(afterSwitch, 'tree-b', 'ツリーB');
      expect(afterNameLoad.editedTreeName).toBe('ツリーA'); // BUG: stale
    });

    it('NEW behavior: tracking currentTreeName correctly syncs after name load', () => {
      const state: SyncState = { editedTreeName: 'ツリーA', prevCurrentTreeName: 'ツリーA' };

      // currentTree changes but currentTreeName is still "ツリーA"
      const afterSwitch = applySyncLogic(state, 'ツリーA');
      expect(afterSwitch.editedTreeName).toBe('ツリーA');

      // currentTreeName finally updates to "ツリーB"
      const afterNameLoad = applySyncLogic(afterSwitch, 'ツリーB');
      expect(afterNameLoad.editedTreeName).toBe('ツリーB'); // FIXED: correct
    });
  });

  describe('accordion close save guard (handleTreeNameSubmit)', () => {
    function shouldSaveTreeName(editedTreeName: string | null, currentTreeName: string | null): boolean {
      return editedTreeName !== null && editedTreeName !== '' && editedTreeName !== currentTreeName;
    }

    it('skips save when editedTreeName === currentTreeName', () => {
      expect(shouldSaveTreeName('ツリーB', 'ツリーB')).toBe(false);
    });

    it('skips save when editedTreeName is empty', () => {
      expect(shouldSaveTreeName('', 'ツリーB')).toBe(false);
    });

    it('skips save when editedTreeName is null', () => {
      expect(shouldSaveTreeName(null, 'ツリーB')).toBe(false);
    });

    it('saves when editedTreeName differs from currentTreeName', () => {
      expect(shouldSaveTreeName('ユーザー編集済み', 'ツリーB')).toBe(true);
    });
  });
});
