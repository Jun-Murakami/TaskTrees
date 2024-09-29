import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { theme, darkTheme } from '@/theme/mui_theme';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useAppStateStore } from '@/store/appStateStore';
import { loadAppStateFromIdb } from '@/services/indexedDbService';
import { useDialogStore, useInputDialogStore } from '@/store/dialogStore';
import { HomePage } from '@/features/homepage/HomePage';
import { PrivacyPolicy } from '@/features/app/PrivacyPolicy';
import { Download } from '@/features/app/Download';
import { ModalDialog } from '@/features/common/ModalDialog';
import { InputDialog } from '@/features/common/InputDialog';

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
  }, [setDarkMode]);

  return (
    <ThemeProvider theme={darkMode ? darkTheme : theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path='/privacy-policy' Component={PrivacyPolicy} />
          <Route path='/download' Component={Download} />
          <Route path='/' Component={HomePage} />
        </Routes>
      </Router>
      {isDialogVisible && <ModalDialog />}
      {isInputDialogVisible && <InputDialog />}
    </ThemeProvider>
  );
}
