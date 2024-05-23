import { create } from 'zustand';
import { useIndexedDb } from '../hooks/useIndexedDb';

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
  isEditingText: boolean;
  quickMemoText: string;
  isLoadedMemoFromDb: boolean;
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
  setIsEditingText: (isEditingText: boolean) => void;
  setQuickMemoText: (quickMemoText: string) => void;
  setIsLoadedMemoFromDb: (isLoadedMemoFromDb: boolean) => void;
};

export const useAppStateStore = create<AppState>((set) => {
  const { loadDarkModeFromIdb } = useIndexedDb();
  loadDarkModeFromIdb().then((darkMode) => set({ darkMode }));

  return {
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
    isEditingText: false,
    quickMemoText: '',
    isLoadedMemoFromDb: false,
    setIsOffline: (isOffline: boolean) => set({ isOffline }),
    setLocalTimestamp: (localTimestamp: number) => set({ localTimestamp }),
    setDarkMode: (darkMode: boolean) => set({ darkMode }),
    setHideDoneItems: (hideDoneItems: boolean) => set({ hideDoneItems }),
    setSystemMessage: (systemMessage: string | null) => set({ systemMessage }),
    setIsLoggedIn: (isLoggedIn: boolean) => set({ isLoggedIn }),
    setUid: (uid: string | null) => set({ uid }),
    setEmail: (email: string | null) => set({ email }),
    setIsLoading: (isLoading: boolean) => set({ isLoading }),
    setIsWaitingForDelete: (isWaitingForDelete: boolean) => set({ isWaitingForDelete }),
    setIsAccordionExpanded: (isAccordionExpanded: boolean) => set({ isAccordionExpanded }),
    setIsQuickMemoExpanded: (isQuickMemoExpanded: boolean) => set({ isQuickMemoExpanded }),
    setIsFocusedTreeName: (isFocusedTreeName: boolean) => set({ isFocusedTreeName }),
    setContainerWidth: (containerWidth: number) => set({ containerWidth }),
    setSearchKey: (searchKey: string) => set({ searchKey }),
    setIsEditingText: (isEditingText: boolean) => set({ isEditingText }),
    setQuickMemoText: (quickMemoText: string) => set({ quickMemoText }),
    setIsLoadedMemoFromDb: (isLoadedMemoFromDb: boolean) => set({ isLoadedMemoFromDb }),
  };
});
