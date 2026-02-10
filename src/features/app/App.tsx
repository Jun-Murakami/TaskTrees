import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PlatformRouter as Router } from '@/features/app/PlatformRouter';
import { indexedDb } from '@/indexedDb';
import { theme, darkTheme } from '@/theme/mui_theme';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useAppStateStore } from '@/store/appStateStore';
import { loadAppStateFromIdb } from '@/services/indexedDbService';
import { useDialogStore, useInputDialogStore } from '@/store/dialogStore';
import { HomePage } from '@/features/homepage/HomePage';
import { PrivacyPolicy } from '@/features/app/PrivacyPolicy';
import { Download } from '@/features/app/Download';
import { AuthElectronGoogle } from '@/features/app/AuthElectronGoogle';
import { AuthElectronApple } from '@/features/app/AuthElectronApple';
import { AuthElectronRedirect } from '@/features/app/AuthElectronRedirect';
import { DeleteAccount } from '@/features/app/DeleteAccount';
import { ModalDialog } from '@/features/common/ModalDialog';
import { InputDialog } from '@/features/common/InputDialog';
import { ErrorBoundary } from '@/features/common/ErrorBoundary';

export default function App() {
  const darkMode = useAppStateStore((state) => state.darkMode); // ダークモードの状態
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const isDialogVisible = useDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);
  const isInputDialogVisible = useInputDialogStore((state: { isDialogVisible: boolean }) => state.isDialogVisible);

  useEffect(() => {
    const asyncFunc = async () => {
      try {
        const appState = await loadAppStateFromIdb();
        if (appState) {
          setDarkMode(appState.settings.darkMode);
        }
      } catch (error) {
        console.error('アプリの状態を読み込めませんでした', error);
      }
    };
    asyncFunc();

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        if (!indexedDb.isOpen()) {
          await indexedDb.open();
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setDarkMode]);

  return (
    <ErrorBoundary>
      <ThemeProvider theme={darkMode ? darkTheme : theme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path='/privacy-policy' element={<PrivacyPolicy />} />
            <Route path='/download' element={<Download />} />
            <Route path='/auth/google' element={<AuthElectronGoogle />} />
            <Route path='/auth/apple' element={<AuthElectronApple />} />
            <Route path='/auth/redirect' element={<AuthElectronRedirect />} />
            <Route path='/delete-account' element={<DeleteAccount />} />
            <Route path='/' element={<HomePage />} />
          </Routes>
        </Router>
        {isDialogVisible && <ModalDialog />}
        {isInputDialogVisible && <InputDialog />}
      </ThemeProvider>
    </ErrorBoundary>
  );
}
