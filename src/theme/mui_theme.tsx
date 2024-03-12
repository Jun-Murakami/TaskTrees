import { createTheme } from '@mui/material/styles';
import '@fontsource/m-plus-1p';

const fontFamilySet = [
  '"M PLUS 1p"',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(',');

const breakpointsValues = {
  xs: 0,
  sm: 750,
  md: 960,
  lg: 1280,
  xl: 1920,
};

const windowsScrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '12px',
    borderRadius: '8px',
  },
  '&::-webkit-scrollbar-track': {
    boxShadow: 'inset 0 0 8px rgba(0,0,0,0.3)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#aaa',
    color: '#aaa',
    borderRadius: '8px',
  },
};

const windowsScrollbarStylesDark = {
  '&::-webkit-scrollbar': {
    width: '12px',
    borderRadius: '8px',
  },
  '&::-webkit-scrollbar-track': {
    boxShadow: 'inset 0 0 8px rgba(255,255,255,0.3)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#666',
    color: '#666',
    borderRadius: '8px',
  },
};

export const theme = createTheme({
  breakpoints: {
    values: breakpointsValues,
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#325599',
    },
    secondary: {
      main: '#ef0a0a',
    },
  },
  typography: {
    fontFamily: fontFamilySet,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body: navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStyles : {},
      },
    },
  },
});

export const darkTheme = createTheme({
  breakpoints: {
    values: breakpointsValues,
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#325599',
    },
    secondary: {
      main: '#ef0a0a',
    },
  },
  typography: {
    fontFamily: fontFamilySet,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body: navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStylesDark : {},
      },
    },
  },
});
