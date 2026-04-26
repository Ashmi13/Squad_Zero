// frontend/src/components/DevNav.jsx
// ⚠️  DEV ONLY — automatically hidden in production builds
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MEMBERS = [
  {
    id: 1,
    name: 'Nihaaj',
    color: '#6366f1',
    routes: [
      { label: 'Landing Page',      path: '/' },
      { label: 'Sign In',           path: '/login' },
      { label: 'Sign Up',           path: '/signup' },
      { label: 'OAuth Callback',    path: '/oauth/callback' },
      { label: 'Dashboard',         path: '/dashboard' },
      { label: 'Forgot Password',   path: '/forgot-password' },
      { label: 'Account Verified',  path: '/account-verified' },
      { label: '⚡ Go to Tasks',     path: '/login' },
    ],
  },
 {
    id: 2,
    name: 'Ashmitha',
    color: '#0ea5e9',
    routes: [
      { label: 'File Manager',      path: '/files' },
      { label: 'Dashboard Home',    path: '/dashboard' },
      { label: 'Pomodoro',          path: '/pomodoro' },
      { label: 'Flashcards',        path: '/flashcards' },
    ],
  },
  {
    id: 3,
    name: 'Sandavi',
    color: '#10b981',
    routes: [
      { label: 'Notes Dashboard',   path: '/notes' },
      { label: 'Note Editor',       path: '/notes/editor/test-note' },
      { label: 'Create Note',       path: '/files/create-note' },
    ],
  },
  {
    id: 4,
    name: 'Member 4',
    color: '#f59e0b',
    routes: [
      { label: 'Quiz',              path: '/quiz' },
      { label: 'Quiz History',      path: '/quiz/history' },
    ],
  },
  {
    id: 5,
    name: 'Anoj (M5)',
    color: '#ec4899',
   routes: [
      { label: 'Task Dashboard',    path: '/tasks' },
      { label: 'Second Brain',      path: '/second-brain' },
    ],
  },
];

export default function DevNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(1);

  const isDev = import.meta.env.DEV;
  if (!isDev) return null;

  const activeMember = MEMBERS.find(m => m.id === activeTab);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev Navigation"
        style={{
          position:       'fixed',
          bottom:         '24px',
          right:          '24px',
          zIndex:         9999,
          width:          '48px',
          height:         '48px',
          borderRadius:   '50%',
          background:     '#1e1e2e',
          color:          '#cdd6f4',
          border:         '2px solid #45475a',
          fontSize:       '20px',
          cursor:         'pointer',
          boxShadow:      '0 4px 20px rgba(0,0,0,0.4)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        {open ? '✕' : '🧭'}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position:     'fixed',
          bottom:       '84px',
          right:        '24px',
          zIndex:       9998,
          width:        '300px',
          background:   '#1e1e2e',
          border:       '1px solid #45475a',
          borderRadius: '12px',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
          overflow:     'hidden',
          fontFamily:   'monospace',
        }}>

          {/* Header */}
          <div style={{
            padding:        '10px 14px',
            borderBottom:   '1px solid #45475a',
            color:          '#cdd6f4',
            fontSize:       '11px',
            letterSpacing:  '0.08em',
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
          }}>
            <span>🛠 DEV PANEL</span>
            <span style={{
              color:        '#585b70',
              background:   '#313244',
              padding:      '2px 8px',
              borderRadius: '4px',
              fontSize:     '10px',
            }}>
              {location.pathname}
            </span>
          </div>

          {/* Member tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #45475a' }}>
            {MEMBERS.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                style={{
                  flex:         1,
                  padding:      '8px 0',
                  background:   activeTab === m.id ? m.color + '22' : 'transparent',
                  color:        activeTab === m.id ? m.color : '#585b70',
                  border:       'none',
                  borderBottom: activeTab === m.id
                    ? `2px solid ${m.color}`
                    : '2px solid transparent',
                  cursor:       'pointer',
                  fontSize:     '11px',
                  fontFamily:   'monospace',
                  fontWeight:   activeTab === m.id ? 'bold' : 'normal',
                  transition:   'all 0.15s',
                }}
              >
                M{m.id}
              </button>
            ))}
          </div>

          {/* Routes for active member */}
          <div style={{ padding: '8px' }}>
            <div style={{
              color:      activeMember.color,
              fontSize:   '11px',
              padding:    '4px 6px 8px',
              fontWeight: 'bold',
            }}>
              {activeMember.name}
            </div>

            {activeMember.routes.map(route => {
              const isActive = location.pathname === route.path;
              return (
                <button
                  key={route.path + route.label}
                  onClick={() => { navigate(route.path); setOpen(false); }}
                  style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                    width:        '100%',
                    padding:      '8px 10px',
                    background:   isActive ? activeMember.color + '18' : 'transparent',
                    color:        isActive ? activeMember.color : '#cdd6f4',
                    border:       'none',
                    borderRadius: '6px',
                    cursor:       'pointer',
                    fontSize:     '12px',
                    fontFamily:   'monospace',
                    textAlign:    'left',
                    transition:   'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = '#313244';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ color: activeMember.color }}>
                    {isActive ? '●' : '→'}
                  </span>
                  {route.label}
                  <span style={{
                    marginLeft: 'auto',
                    color:      '#45475a',
                    fontSize:   '10px',
                    whiteSpace: 'nowrap',
                  }}>
                    {route.path}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding:        '8px 14px',
            borderTop:      '1px solid #45475a',
            color:          '#45475a',
            fontSize:       '10px',
            display:        'flex',
            justifyContent: 'space-between',
          }}>
            <span>develop branch</span>
            <span>hidden in prod ✓</span>
          </div>
        </div>
      )}
    </>
  );
}
