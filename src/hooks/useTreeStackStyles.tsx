import { useTheme } from '@mui/material/styles';

export const useTreeStackStyles = (
  clone: boolean | undefined,
  ghost: boolean | undefined,
  depth: number,
  isDragOver: boolean,
  darkMode: boolean,
  isNewTask?: boolean
) => {
  const theme = useTheme();
  return {
    width: '100%',
    padding: { xs: 0.7, sm: 1 },
    border: '1px solid',
    backgroundColor: isDragOver
      ? theme.palette.action.focus
      : darkMode
      ? depth >= 4
        ? theme.palette.grey[800]
        : depth === 3
        ? '#303030'
        : depth === 2
        ? theme.palette.grey[900]
        : depth === 1
        ? '#1a1a1a'
        : theme.palette.background.default
      : depth >= 4
      ? theme.palette.grey[300]
      : depth === 3
      ? theme.palette.grey[200]
      : depth === 2
      ? theme.palette.grey[100]
      : depth === 1
      ? theme.palette.grey[50]
      : theme.palette.background.default,
    borderColor: theme.palette.divider,
    boxSizing: 'border-box',
    ...(clone && {
      zIndex: 1000,
      opacity: 0.9,
      position: 'absolute',
      width: '250px',
      boxShadow: '0px 15px 15px 0 rgba(34, 33, 81, 0.1)',
      '& textarea': {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      },
    }),
    ...(clone &&
      isNewTask && {
        left: '50%',
        transform: 'translateX(calc(-50% +125px))',
      }),
    ...(ghost && {
      zIndex: -1,
      padding: 0,
      height: '8px',
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.primary.main,
      '&:before': {
        zIndex: -1,
        position: 'absolute',
        left: '-8px',
        top: '-4px',
        display: 'block',
        content: '""',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        border: '1px solid',
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.background.default,
      },
      '> *': {
        opacity: 0,
        height: 0,
      },
    }),
  };
};
