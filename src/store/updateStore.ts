import { create } from 'zustand';
import type { PlatformInfo } from '@/types/electron';
import type { UpdateInfo } from '@/hooks/useCheckForUpdates';

/**
 * アプリのアップデートチェック結果と UI 表示状態を保持する小さなストア。
 * - 起動時に 1 回だけチェックする（hasChecked で多重実行を防ぐ）
 * - ダイアログの表示制御は HomePage に集約し、MessagePaper はこの store を
 *   読み取るだけ
 */
type UpdateStore = {
  currentVersion: string | null;
  platform: PlatformInfo | null;
  updateInfo: UpdateInfo | null;
  isDialogOpen: boolean;
  hasChecked: boolean;
  setCurrentVersion: (v: string) => void;
  setPlatform: (p: PlatformInfo) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setIsDialogOpen: (open: boolean) => void;
  markChecked: () => void;
};

export const useUpdateStore = create<UpdateStore>((set) => ({
  currentVersion: null,
  platform: null,
  updateInfo: null,
  isDialogOpen: false,
  hasChecked: false,
  setCurrentVersion: (v) => set({ currentVersion: v }),
  setPlatform: (p) => set({ platform: p }),
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setIsDialogOpen: (open) => set({ isDialogOpen: open }),
  markChecked: () => set({ hasChecked: true }),
}));
