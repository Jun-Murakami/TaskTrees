import { createTheme } from '@mui/material/styles';
import '@fontsource/biz-udpgothic';
import '@fontsource/m-plus-1p';

// ユーザーのデバイスのDPIを検出
const dpi = window.devicePixelRatio;

let mainFont = '"BIZ UDPGothic"';

if (dpi >= 1.5) {
  // 1.5倍以上のDPIの場合、M PLIUS 1Pにする
  mainFont = '"M PLUS 1p"';
}
const fontFamilySet = [
  `${mainFont}`,
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

let typographyStyles = {};
if (dpi >= 1.5) {
  typographyStyles = {
    fontFamily: fontFamilySet,
  };
} else {
  typographyStyles = {
    fontFamily: fontFamilySet,
    h3: {
      fontSize: '35px',
    },
    caption: {
      fontSize: '11px',
    },
  };
}

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
  typography: typographyStyles,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body: navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStyles : {},
      },
    },
    MuiTextField: {
      defaultProps: {
        inputProps: {
          spellCheck: 'false',
        },
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
    divider: 'rgba(255, 255, 255, 0.23)',
  },
  typography: typographyStyles,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // ユーザーエージェントにWinを含むか、プラットフォームがWinから始まる場合にスクロールバーのスタイルを適用
        body: navigator.userAgent?.indexOf('Win') > 0 || navigator.platform.startsWith('Win') ? windowsScrollbarStylesDark : {},
      },
    },
    MuiTextField: {
      defaultProps: {
        inputProps: {
          spellCheck: 'false',
        },
      },
    },
  },
});
