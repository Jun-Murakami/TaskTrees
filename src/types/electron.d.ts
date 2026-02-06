import { OAuthCredential } from 'firebase/auth';

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  setDarkMode: (isDarkMode: boolean) => void;
  createNewTree: (callback: () => void) => void;
  removeCreateNewTreeListener: () => void;
  onLoadedContent: (callback: (data: string | null) => void) => void;
  removeLoadedContentListener: () => void;
  saveTree: (callback: () => void) => void;
  removeSaveTreeListener: () => void;
  saveAllTrees: (callback: () => void) => void;
  removeSaveAllTreesListener: () => void;
  toggleMenuItem: (menuItemId: string, enabled: boolean) => void;
  saveLastTree: (callback: () => void) => void;
  removeSaveLastTreeListener: () => void;
  saveBackup: (data: string) => void;
  closeWindow: () => void;
  onBeforeClose: (callback: () => void) => void;
  removeBeforeCloseListener: () => void;
  sendCloseCompleted: (data: string) => void;
  openOAuthURL: (url: string) => Promise<OAuthCredential>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
