import { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { theme, darkTheme } from '../theme/mui_theme';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useIndexedDb } from '../hooks/useIndexedDb';
import { useAppStateStore } from '../store/appStateStore';
import { HomePage } from './HomePage';
import { PrivacyPolicy } from './PrivacyPolicy';
import { Download } from './Download';

export default function App() {
  const darkMode = useAppStateStore((state) => state.darkMode); // ダークモードの状態

  const { loadSettingsFromIdb } = useIndexedDb();

  useEffect(() => {
    const asyncFunc = async () => {
      await loadSettingsFromIdb();
    };
    asyncFunc();
  }, [loadSettingsFromIdb]);

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
    </ThemeProvider>
  );
}
