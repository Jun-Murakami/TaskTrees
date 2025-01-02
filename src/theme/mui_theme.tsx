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

const typographyStyles = {
  fontFamily: fontFamilySet,
  h3: {
    fontSize: '35px',
  },
  caption: {
    fontSize: '11px',
  },
};

const breakpointsValues = {
  xs: 0,
  sm: 750,
  md: 960,
  lg: 1280,
  xl: 1920,
};

const windowsScrollbarStyles = {
  '&::-webkit-scrollbar': {
    width: '10px',
    borderRadius: '5px',
  },
  '&::-webkit-scrollbar-track': {
    boxShadow: 'inset 0 0 8px rgba(0,0,0,0.2)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#bbb',
    color: '#bbb',
    borderRadius: '5px',
  },
};

const windowsScrollbarStylesDark = {
  '&::-webkit-scrollbar': {
    width: '10px',
    borderRadius: '5px',
  },
  '&::-webkit-scrollbar-track': {
    boxShadow: 'inset 0 0 8px rgba(255,255,255,0.2)',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#444',
    color: '#444',
    borderRadius: '5px',
  },
};

export const theme = createTheme({
  cssVariables: true,
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
    warning: {
      main: '#ffcc02',
    },
  },
  typography: typographyStyles,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body:
          navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStyles : undefined,
        a: {
          color: 'var(--mui-palette-primary-main)',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          transform: 'rotate(0.05deg)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        inputProps: {
          spellCheck: 'false',
          transform: 'rotate(0.05deg)',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  cssVariables: true,
  breakpoints: {
    values: breakpointsValues,
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#5275b9',
    },
    secondary: {
      main: '#ef0a0a',
    },
    warning: {
      main: '#edcc02',
    },
    divider: 'rgba(255, 255, 255, 0.18)',
  },
  typography: typographyStyles,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body:
          navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win')
            ? windowsScrollbarStylesDark
            : undefined,
        a: {
          color: 'var(--mui-palette-primary-main)',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          transform: 'rotate(0.05deg)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        inputProps: {
          spellCheck: 'false',
          transform: 'rotate(0.05deg)',
        },
      },
    },
  },
});
