import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer'
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList } from '../types/types';

type TreeState = {
  items: TreeItem[];
  treesList: TreesList;
  currentTree: UniqueIdentifier | null;
  currentTreeName: string | null;
  currentTreeMembers: { uid: string; email: string }[] | null;
  setItems: (items: TreeItem[]) => void;
  setTreesList: (treesList: TreesList) => void;
  setCurrentTree: (currentTree: UniqueIdentifier | null) => void;
  setCurrentTreeName: (currentTreeName: string | null) => void;
  setCurrentTreeMembers: (currentTreeMembers: { uid: string; email: string }[] | null) => void;
};

export const useTreeStateStore = create<TreeState>()(immer((set) => ({
  items: [],
  treesList: [],
  currentTree: null,
  currentTreeName: null,
  currentTreeMembers: null,
  setItems: (items) => set((state) => {
    state.items = items;
  }),
  setTreesList: (treesList) => set((state) => {
    state.treesList = treesList;
  }),
  setCurrentTree: (currentTree) => set((state) => {
    state.currentTree = currentTree;
  }),
  setCurrentTreeName: (currentTreeName) => set((state) => {
    state.currentTreeName = currentTreeName;
  }),
  setCurrentTreeMembers: (currentTreeMembers) => set((state) => {
    state.currentTreeMembers = currentTreeMembers;
  }),
})));