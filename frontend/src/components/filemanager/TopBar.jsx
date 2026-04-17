import React from 'react';
import { Search, Bell, Moon, Sun } from 'lucide-react';

const TopBar = ({ folderName }) => {
  const [dark, setDark] = React.useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 24px',
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #ebebeb',
    }}>

      {/* Left - Title */}
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1a1a2e' }}>
          {folderName || 'My Files'}
        </h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
          Manage your study materials
        </p>
      </div>

      {/* Right - Search + icons + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: '#f5f5f5', borderRadius: '10px',
          padding: '8px 14px',
        }}>
          <Search size={16} color="#999" />
          <input
            placeholder="Search Notes..."
            style={{
              border: 'none', background: 'none', outline: 'none',
              fontSize: '14px', color: '#333', width: '180px'
            }}
          />
        </div>

        {/* Bell */}
        <div style={{
          position: 'relative', cursor: 'pointer',
          width: '36px', height: '36px', borderRadius: '50%',
          backgroundColor: '#f5f5f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Bell size={18} color="#555" />
          <div style={{
            position: 'absolute', top: '6px', right: '6px',
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: '#ff4d4d'
          }} />
        </div>

        {/* Dark mode toggle */}
        <div
          onClick={() => setDark(!dark)}
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: '#f5f5f5', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {dark ? <Sun size={18} color="#555" /> : <Moon size={18} color="#555" />}
        </div>

        {/* Profile */}
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          backgroundColor: '#6C5DD3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer'
        }}>
          S
        </div>

      </div>
    </div>
  );
};

export default TopBar;