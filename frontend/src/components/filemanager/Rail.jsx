import React, { useState } from 'react';
import { Home, FolderOpen, BrainCircuit, CheckSquare, Edit3, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import SettingsPanel from './SettingsPanel';

const Rail = ({ activeView, setActiveView }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{
      width: '60px',
      height: '100vh',
      backgroundColor: '#1e1e2e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '20px',
      gap: '10px'
    }}>

      {/* Logo */}
      <div style={{
        width: '36px', height: '36px',
        backgroundColor: '#6C5DD3',
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 'bold', fontSize: '16px',
        marginBottom: '20px'
      }}>
        N
      </div>

      {/* Home icon */}
      <div
       onClick={() => { navigate('/files'); setActiveView('home'); }}
        style={{
          width: '44px', height: '44px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          backgroundColor: activeView === 'home' ? '#6C5DD3' : 'transparent',
          color: activeView === 'home' ? 'white' : '#888',
          transition: 'all 0.2s'
        }}
      >
        <Home size={22} strokeWidth={1.5} />
      </div>

      {/* Folder icon */}
      <div
        onClick={() => { navigate('/files'); setActiveView('files'); }}
        style={{
          width: '44px', height: '44px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          backgroundColor: activeView === 'files' ? '#6C5DD3' : 'transparent',
          color: activeView === 'files' ? 'white' : '#888',
          transition: 'all 0.2s'
        }}
      >
        <FolderOpen size={22} strokeWidth={1.5} />
      </div>

      {/* Other nav icons */}
     {[
  { icon: BrainCircuit, path: '/notes', view: 'notes' },
  { icon: CheckSquare, path: '/tasks', view: 'tasks' },
  { icon: Edit3, path: '/quiz', view: 'quiz' },
].map(({ icon: Icon, path, view }) => (
  <div
    key={path}
    onClick={() => { navigate(path); setActiveView(view); }}
    style={{
      width: '44px', height: '44px', borderRadius: '12px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      backgroundColor: activeView === view ? '#6C5DD3' : 'transparent',
      color: activeView === view ? 'white' : '#888',
      transition: 'all 0.2s'
    }}
  >
    <Icon size={22} strokeWidth={1.5} />
  </div>
))}

      {/* Settings icon */}
      <div
        onClick={() => setShowSettings(true)}
        style={{
          marginTop: 'auto', marginBottom: '20px', color: '#888',
          cursor: 'pointer', width: '44px', height: '44px',
          borderRadius: '12px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Settings size={22} strokeWidth={1.5} />
      </div>

      {/* Settings Panel */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

    </div>
  );
};

export default Rail;