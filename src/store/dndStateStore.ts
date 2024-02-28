import { create } from 'zustand';
import { UniqueIdentifier } from '@dnd-kit/core';
import type { Projected } from '../types/types';

type DndState = {
  activeListId: UniqueIdentifier | null;
  activeTreeId: UniqueIdentifier | null;
  overListId: UniqueIdentifier | null;
  overTreeId: UniqueIdentifier | null;
  offsetLeft: number;
  projected: Projected;
  setActiveListId: (activeListId: UniqueIdentifier | null) => void;
  setActiveTreeId: (activeTreeId: UniqueIdentifier | null) => void;
  setOverListId: (overListId: UniqueIdentifier | null) => void;
  setOverTreeId: (overTreeId: UniqueIdentifier | null) => void;
  setOffsetLeft: (offsetLeft: number) => void;
  setProjected: (projected: Projected) => void;
};

export const useDndStateStore = create<DndState>((set) => ({
  activeListId: null,
  activeTreeId: null,
  overListId: null,
  overTreeId: null,
  offsetLeft: 0,
  projected: null,
  setActiveListId: (activeListId) => set((state) => ({ ...state, activeListId })),
  setActiveTreeId: (activeTreeId) => set((state) => ({ ...state, activeTreeId })),
  setOverListId: (overListId) => set((state) => ({ ...state, overListId })),
  setOverTreeId: (overTreeId) => set((state) => ({ ...state, overTreeId })),
  setOffsetLeft: (offsetLeft) => set((state) => ({ ...state, offsetLeft })),
  setProjected: (projected) => set((state) => ({ ...state, projected })),
}));
