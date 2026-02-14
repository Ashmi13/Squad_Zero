import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ZenTheme } from './themes';
import TaskDashboard from './components/tasks/TaskDashboard';

function App() {
  return (
    <ThemeProvider theme={ZenTheme}>
      <CssBaseline />
      <TaskDashboard />
    </ThemeProvider>
  );
}

export default App;
