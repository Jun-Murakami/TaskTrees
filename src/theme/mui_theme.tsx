import { createTheme } from '@mui/material/styles';
import '@fontsource/m-plus-1p';

export const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 750,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
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
    fontFamily: [
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
    ].join(','),
  },
});

export const darkTheme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 750,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
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
    fontFamily: [
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
    ].join(','),
  },
});
