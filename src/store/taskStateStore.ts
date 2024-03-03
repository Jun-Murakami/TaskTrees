import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer'
import { UniqueIdentifier } from '@dnd-kit/core';

type TaskState = {
  lastSelectedItemId: UniqueIdentifier | null;
  setLastSelectedItemId: (lastSelectedItemId: UniqueIdentifier | null) => void;
}

export const useTaskStateStore = create<TaskState>()(immer((set) => ({
  lastSelectedItemId: null,
  setLastSelectedItemId: (lastSelectedItemId) => set((state) => { state.lastSelectedItemId = lastSelectedItemId; }),
})));