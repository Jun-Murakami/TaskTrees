import { create } from 'zustand';
import { UniqueIdentifier } from '@dnd-kit/core';
import { TreeItem, TreesList } from '../types/types';

type TreeState = {
  items: TreeItem[];
  treesList: TreesList;
  searchResults: TreesList;
  currentTree: UniqueIdentifier | null;
  currentTreeName: string | null;
  currentTreeMembers: { uid: string; email: string }[] | null;
  currentTreeIsArchived: boolean | null;
  prevCurrentTree: UniqueIdentifier | null;
  prevItems: TreeItem[];
  setItems: (items: TreeItem[]) => void;
  setTreesList: (treesList: TreesList) => void;
  setSearchResults: (searchResults: TreesList) => void;
  setCurrentTree: (currentTree: UniqueIdentifier | null) => void;
  setCurrentTreeName: (currentTreeName: string | null) => void;
  setCurrentTreeMembers: (currentTreeMembers: { uid: string; email: string }[] | null) => void;
  setCurrentTreeIsArchived: (currentTreeIsArchived: boolean | null) => void;
  setPrevCurrentTree: (prevCurrentTree: UniqueIdentifier | null) => void;
  setPrevItems: (prevItems: TreeItem[]) => void;
};

export const useTreeStateStore = create<TreeState>((set) => ({
  items: [],
  treesList: [],
  searchResults: [],
  currentTree: null,
  currentTreeName: null,
  currentTreeMembers: null,
  prevCurrentTree: null,
  prevItems: [],
  currentTreeIsArchived: null,
  setItems: (items) => set({ items }),
  setTreesList: (treesList) => set({ treesList }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setCurrentTree: (currentTree) => set({ currentTree }),
  setCurrentTreeName: (currentTreeName) => set({ currentTreeName }),
  setCurrentTreeMembers: (currentTreeMembers) => set({ currentTreeMembers }),
  setCurrentTreeIsArchived: (currentTreeIsArchived) => set({ currentTreeIsArchived }),
  setPrevCurrentTree: (prevCurrentTree) => set({ prevCurrentTree }),
  setPrevItems: (prevItems) => set({ prevItems }),
}));
