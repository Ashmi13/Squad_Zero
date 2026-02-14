export const components = {
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(107, 123, 63, 0.12)',
        boxShadow: '0 4px 20px rgba(107, 123, 63, 0.08)',
      },
    },
  },
  
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        borderRadius: 8,
        padding: '10px 20px',
        transition: 'all 0.2s',
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(107, 123, 63, 0.25)',
          transform: 'translateY(-1px)',
        },
      },
    },
  },
  
  MuiCheckbox: {
    styleOverrides: {
      root: {
        color: '#6B7B3F',
        '&.Mui-checked': {
          color: '#6B7B3F',
        },
      },
    },
  },
  
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        backgroundColor: 'rgba(107, 123, 63, 0.12)',
      },
      bar: {
        borderRadius: 6,
        background: 'linear-gradient(90deg, #6B7B3F, #8B9B5F)',
      },
    },
  },
};
