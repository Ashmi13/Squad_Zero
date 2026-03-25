
export const components = {
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
      },
    },
  },
  
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 600,
        borderRadius: 16,
        padding: '12px 24px',
        transition: 'all 0.2s',
      },
      contained: {
        background: 'linear-gradient(135deg, #6366f1, #4338ca)',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
          filter: 'brightness(1.1)',
        },
      },
    },
  },
  
  MuiCheckbox: {
    styleOverrides: {
      root: {
        color: '#6366f1',
        '&.Mui-checked': {
          color: '#6366f1',
        },
      },
    },
  },
  
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
      },
      bar: {
        borderRadius: 4,
        background: 'linear-gradient(90deg, #6366f1, #ec4899)',
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      root: {
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      },
      indicator: {
        height: 3,
        borderRadius: '3px 3px 0 0',
        background: 'linear-gradient(90deg, #6366f1, #ec4899)',
      },
    },
  },
  
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        color: '#9ca3af',
        '&.Mui-selected': {
          color: '#f3f4f6',
        },
        '&:hover': {
          color: '#f3f4f6',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
        },
      },
    },
  },
};
