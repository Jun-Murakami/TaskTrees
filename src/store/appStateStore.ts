import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OAuthCredential } from 'firebase/auth';

type AppState = {
  isOffline: boolean;
  isConnectedDb: boolean;
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
  isLoadedMemoFromDb: boolean;
  isShowArchive: boolean;
  recievedCredential: OAuthCredential | null;
  isQuickMemoDocked: boolean;
  quickMemoPosition: { x: number; y: number };
  quickMemoSize: { width: number; height: number };
  setIsOffline: (isOffline: boolean) => void;
  setIsConnectedDb: (isConnectedDb: boolean) => void;
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
  setIsLoadedMemoFromDb: (isLoadedMemoFromDb: boolean) => void;
  setIsShowArchive: (isShowArchive: boolean) => void;
  setRecievedCredential: (recievedCredential: OAuthCredential | null) => void;
  setIsQuickMemoDocked: (docked: boolean) => void;
  setQuickMemoPosition: (pos: { x: number; y: number }) => void;
  setQuickMemoSize: (size: { width: number; height: number }) => void;
};

export const useAppStateStore = create<AppState>()(
  persist(
    (set) => ({
      isOffline: false,
      isConnectedDb: false,
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
      isLoadedMemoFromDb: false,
      isShowArchive: false,
      recievedCredential: null,
      isQuickMemoDocked: true,
      quickMemoPosition: { x: 100, y: 100 },
      quickMemoSize: { width: 400, height: 200 },
      setIsOffline: (isOffline) => set({ isOffline }),
      setIsConnectedDb: (isConnectedDb) => set({ isConnectedDb }),
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
      setIsLoadedMemoFromDb: (isLoadedMemoFromDb) => set({ isLoadedMemoFromDb }),
      setIsShowArchive: (isShowArchive) => set({ isShowArchive }),
      setRecievedCredential: (recievedCredential) => set({ recievedCredential }),
      setIsQuickMemoDocked: (docked) => set({ isQuickMemoDocked: docked }),
      setQuickMemoPosition: (pos) => set({ quickMemoPosition: pos }),
      setQuickMemoSize: (size) => set({ quickMemoSize: size }),
    }),
    {
      name: 'app-state',
      partialize: (state) => ({
        isQuickMemoDocked: state.isQuickMemoDocked,
        quickMemoPosition: state.quickMemoPosition,
        quickMemoSize: state.quickMemoSize,
      }),
    }
  )
);
