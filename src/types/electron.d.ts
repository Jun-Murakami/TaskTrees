import { OAuthCredential } from 'firebase/auth';

export interface UpdateDownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface UpdateDownloadResult {
  success: boolean;
  /** 'cancelled' のときはユーザーがキャンセル */
  error?: string;
}

export interface PlatformInfo {
  /** process.platform: 'darwin' | 'win32' | 'linux' */
  osInfo: NodeJS.Platform;
  /** AppImage 起動時のみ true。deb 等のシステムインストールは false */
  isAppImage: boolean;
}

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

  // プラットフォーム情報
  getPlatformInfo: () => Promise<PlatformInfo>;
  // 外部 URL を OS の既定ブラウザで開く
  openExternalLink: (url: string) => void;
  // アップデート
  startUpdateDownload: (downloadUrl: string) => Promise<UpdateDownloadResult>;
  cancelUpdateDownload: () => void;
  onUpdateDownloadProgress: (
    callback: (progress: UpdateDownloadProgress) => void,
  ) => void;
  removeUpdateDownloadProgressListener: () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
