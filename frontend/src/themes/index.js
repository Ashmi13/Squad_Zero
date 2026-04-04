import { createTheme } from '@mui/material/styles';
import { palette } from './palette';
import { typography } from './typography';
import { components } from './components';
import { shadows } from './shadows';

export const ZenTheme = createTheme({
  palette,
  typography,
  components,
  shadows,
  
  shape: {
    borderRadius: 12,
  },
  
  spacing: 8,
  
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
    },
  },
  
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
});

export { palette, typography, components, shadows };
