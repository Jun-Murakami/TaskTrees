import { create } from 'zustand';

type AppState = {
  isOffline: boolean;
  localTimestamp: number;
  darkMode: boolean;
  hideDoneItems: boolean;
  systemMessage: string | null;
  isLoggedIn: boolean;
  uid: string | null;
  email: string | null;
  isLoading: boolean;
  isWaitingForDelete: boolean;
  isAccordionExpanded: boolean;
  isQuickMemoExpanded: boolean;
  isFocusedTreeName: boolean;
  containerWidth: number;
  searchKey: string;
  quickMemoText: string;
  setIsOffline: (isOffline: boolean) => void;
  setLocalTimestamp: (localTimestamp: number) => void;
  setDarkMode: (darkMode: boolean) => void;
  setHideDoneItems: (hideDoneItems: boolean) => void;
  setSystemMessage: (systemMessage: string | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setUid: (uid: string | null) => void;
  setEmail: (email: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsWaitingForDelete: (isWaitingForDelete: boolean) => void;
  setIsAccordionExpanded: (isAccordionExpanded: boolean) => void;
  setIsQuickMemoExpanded: (isQuickMemoExpanded: boolean) => void;
  setIsFocusedTreeName: (isFocusedTreeName: boolean) => void;
  setContainerWidth: (containerWidth: number) => void;
  setSearchKey: (searchKey: string) => void;
  setQuickMemoText: (quickMemoText: string) => void;
};

export const useAppStateStore = create<AppState>((set) => ({
  isOffline: false,
  localTimestamp: 0,
  darkMode: false,
  hideDoneItems: false,
  systemMessage: null,
  isLoggedIn: true,
  uid: null,
  email: null,
  isLoading: true,
  isWaitingForDelete: false,
  isAccordionExpanded: false,
  isQuickMemoExpanded: false,
  isFocusedTreeName: false,
  containerWidth: 0,
  searchKey: '',
  quickMemoText: '',
  setIsOffline: (isOffline) => set({ isOffline }),
  setLocalTimestamp: (localTimestamp) => set({ localTimestamp }),
  setDarkMode: (darkMode) => set({ darkMode }),
  setHideDoneItems: (hideDoneItems) => set({ hideDoneItems }),
  setSystemMessage: (systemMessage) => set({ systemMessage }),
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setUid: (uid) => set({ uid }),
  setEmail: (email) => set({ email }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsWaitingForDelete: (isWaitingForDelete) => set({ isWaitingForDelete }),
  setIsAccordionExpanded: (isAccordionExpanded) => set({ isAccordionExpanded }),
  setIsQuickMemoExpanded: (isQuickMemoExpanded) => set({ isQuickMemoExpanded }),
  setIsFocusedTreeName: (isFocusedTreeName) => set({ isFocusedTreeName }),
  setContainerWidth: (containerWidth) => set({ containerWidth }),
  setSearchKey: (searchKey) => set({ searchKey }),
  setQuickMemoText: (quickMemoText) => set({ quickMemoText }),
}));
