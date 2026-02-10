import { create } from 'zustand';
import { TreeItems } from '@/types/types';

type SyncDocumentMeta<T = unknown> = {
  dirty: boolean;
  baseSnapshot: T | null;
  baseHash: string;
  lastServerHash: string;
};

type SyncState = {
  itemsSync: SyncDocumentMeta<TreeItems>;
  memoSync: SyncDocumentMeta<string>;
  isSyncing: boolean;

  markItemsDirty: () => void;
  clearItemsDirty: () => void;
  setItemsServerHash: (hash: string) => void;
  setItemsBaseFromServer: (items: TreeItems, hash: string) => void;

  markMemoDirty: () => void;
  clearMemoDirty: () => void;
  setMemoServerHash: (hash: string) => void;
  setMemoBaseFromServer: (memo: string, hash: string) => void;

  setIsSyncing: (syncing: boolean) => void;
  resetAllSync: () => void;
};

const initialSyncMeta = <T>(): SyncDocumentMeta<T> => ({
  dirty: false,
  baseSnapshot: null as T | null,
  baseHash: '',
  lastServerHash: '',
});

export const useSyncStateStore = create<SyncState>((set) => ({
  itemsSync: initialSyncMeta<TreeItems>(),
  memoSync: initialSyncMeta<string>(),
  isSyncing: false,

  markItemsDirty: () =>
    set((state) => {
      if (state.itemsSync.dirty) return state;
      return {
        itemsSync: {
          ...state.itemsSync,
          dirty: true,
        },
      };
    }),

  clearItemsDirty: () =>
    set((state) => ({
      itemsSync: {
        ...state.itemsSync,
        dirty: false,
        baseSnapshot: null,
        baseHash: '',
      },
    })),

  setItemsServerHash: (hash) =>
    set((state) => ({
      itemsSync: {
        ...state.itemsSync,
        lastServerHash: hash,
      },
    })),

  setItemsBaseFromServer: (items, hash) =>
    set(() => ({
      itemsSync: {
        dirty: false,
        baseSnapshot: items,
        baseHash: hash,
        lastServerHash: hash,
      },
    })),

  markMemoDirty: () =>
    set((state) => {
      if (state.memoSync.dirty) return state;
      return {
        memoSync: {
          ...state.memoSync,
          dirty: true,
        },
      };
    }),

  clearMemoDirty: () =>
    set((state) => ({
      memoSync: {
        ...state.memoSync,
        dirty: false,
        baseSnapshot: null,
        baseHash: '',
      },
    })),

  setMemoServerHash: (hash) =>
    set((state) => ({
      memoSync: {
        ...state.memoSync,
        lastServerHash: hash,
      },
    })),

  setMemoBaseFromServer: (memo, hash) =>
    set(() => ({
      memoSync: {
        dirty: false,
        baseSnapshot: memo,
        baseHash: hash,
        lastServerHash: hash,
      },
    })),

  setIsSyncing: (syncing) => set({ isSyncing: syncing }),

  resetAllSync: () =>
    set({
      itemsSync: initialSyncMeta<TreeItems>(),
      memoSync: initialSyncMeta<string>(),
      isSyncing: false,
    }),
}));
