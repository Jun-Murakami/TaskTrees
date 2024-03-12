import { create } from 'zustand';

type AppState = {
  darkMode: boolean;
  hideDoneItems: boolean;
  systemMessage: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isWaitingForDelete: boolean;
  isAccordionExpanded: boolean;
  isFocusedTreeName: boolean;
  containerWidth: number;
  setDarkMode: (darkMode: boolean) => void;
  setHideDoneItems: (hideDoneItems: boolean) => void;
  setSystemMessage: (systemMessage: string | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsWaitingForDelete: (isWaitingForDelete: boolean) => void;
  setIsAccordionExpanded: (isAccordionExpanded: boolean) => void;
  setIsFocusedTreeName: (isFocusedTreeName: boolean) => void;
  setContainerWidth: (containerWidth: number) => void;
};

export const useAppStateStore = create<AppState>((set) => ({
  darkMode: false,
  hideDoneItems: false,
  systemMessage: null,
  isLoggedIn: false,
  isLoading: true,
  isWaitingForDelete: false,
  isAccordionExpanded: false,
  isFocusedTreeName: false,
  containerWidth: 0,
  setDarkMode: (darkMode) => set({ darkMode }),
  setHideDoneItems: (hideDoneItems) => set({ hideDoneItems }),
  setSystemMessage: (systemMessage) => set({ systemMessage }),
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsWaitingForDelete: (isWaitingForDelete) => set({ isWaitingForDelete }),
  setIsAccordionExpanded: (isAccordionExpanded) => set({ isAccordionExpanded }),
  setIsFocusedTreeName: (isFocusedTreeName) => set({ isFocusedTreeName }),
  setContainerWidth: (containerWidth) => set({ containerWidth }),
}));
