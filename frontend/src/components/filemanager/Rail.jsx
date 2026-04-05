import React from 'react';
import { Home, FolderOpen, BrainCircuit, CheckSquare, Edit3, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Rail = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const icons = [
    { icon: Home,        path: '/dashboard' },
    { icon: FolderOpen,  path: '/files' },
    { icon: BrainCircuit,path: '/notes' },
    { icon: CheckSquare, path: '/tasks' },
    { icon: Edit3,       path: '/quiz' },
  ];

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

      {/* Nav Icons */}
      {icons.map(({ icon: Icon, path }) => (
        <div
          key={path}
          onClick={() => navigate(path)}
          style={{
            width: '44px', height: '44px',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            backgroundColor: location.pathname === path ? '#6C5DD3' : 'transparent',
            color: location.pathname === path ? 'white' : '#888',
            transition: 'all 0.2s'
          }}
        >
          <Icon size={22} strokeWidth={1.5} />
        </div>
      ))}

      {/* Settings at bottom */}
      <div style={{ marginTop: 'auto', marginBottom: '20px', color: '#888', cursor: 'pointer' }}>
        <Settings size={22} strokeWidth={1.5} />
      </div>

    </div>
  );
};

export default Rail;