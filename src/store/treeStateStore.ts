import { create } from 'zustand';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList } from '../types/types';

type TreeState = {
  items: TreeItem[];
  treesList: TreesList;
  currentTree: UniqueIdentifier | null;
  currentTreeName: string | null;
  currentTreeMembers: { uid: string; email: string }[] | null;
  prevCurrentTree: UniqueIdentifier | null;
  prevItems: TreeItem[];
  setItems: (items: TreeItem[]) => void;
  setTreesList: (treesList: TreesList) => void;
  setCurrentTree: (currentTree: UniqueIdentifier | null) => void;
  setCurrentTreeName: (currentTreeName: string | null) => void;
  setCurrentTreeMembers: (currentTreeMembers: { uid: string; email: string }[] | null) => void;
  setPrevCurrentTree: (prevCurrentTree: UniqueIdentifier | null) => void;
  setPrevItems: (prevItems: TreeItem[]) => void;
};

export const useTreeStateStore = create<TreeState>((set) => ({
  items: [],
  treesList: [],
  currentTree: null,
  currentTreeName: null,
  currentTreeMembers: null,
  prevCurrentTree: null,
  prevItems: [],
  setItems: (items) => set({ items }),
  setTreesList: (treesList) => set({ treesList }),
  setCurrentTree: (currentTree) => set({ currentTree }),
  setCurrentTreeName: (currentTreeName) => set({ currentTreeName }),
  setCurrentTreeMembers: (currentTreeMembers) => set({ currentTreeMembers }),
  setPrevCurrentTree: (prevCurrentTree) => set({ prevCurrentTree }),
  setPrevItems: (prevItems) => set({ prevItems }),
}));
