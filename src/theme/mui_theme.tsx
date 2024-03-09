import { createTheme } from '@mui/material/styles'
import '@fontsource/m-plus-1p'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#325599'
    },
    secondary: {
      main: '#ef0a0a'
    }
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
      '"Segoe UI Symbol"'
    ].join(',')
  }
})

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#325599'
    },
    secondary: {
      main: '#ef0a0a'
    }
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
      '"Segoe UI Symbol"'
    ].join(',')
  }
})
