import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NoteEditor from './pages/NoteEditor';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/editor/:noteId" element={<NoteEditor />} />
      </Routes>
    </Router>
  );
}

export default App;
