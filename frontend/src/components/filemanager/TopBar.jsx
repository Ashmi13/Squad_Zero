import React from 'react';
import { Search, Bell, ShieldAlert, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { config } from '@/config/env';
import { clearTokens, getAccessToken } from '@/utils/tokenStorage';
import NotificationBell from '@/components/NotificationBell';

const TopBar = ({ folderName }) => {
  const { isDark, toggleTheme, theme } = useTheme();
  const [user, setUser] = React.useState(null);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showAlerts, setShowAlerts] = React.useState(false);
  const [adminAlerts, setAdminAlerts] = React.useState([]);
  const [alertsLoading, setAlertsLoading] = React.useState(false);

  const iconButtonStyle = {
    position: 'relative', cursor: 'pointer',
    width: '36px', height: '36px', borderRadius: '50%',
    backgroundColor: theme.colors.ui.input,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background-color 0.3s',
  };

  const popoverStyle = {
    position: 'absolute',
    top: '44px',
    right: 0,
    width: '320px',
    background: theme.colors.bg.primary,
    border: `1px solid ${theme.colors.ui.border}`,
    borderRadius: '12px',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.15)',
    zIndex: 100,
    maxHeight: '300px',
    overflowY: 'auto',
  };

  React.useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  React.useEffect(() => {
    const syncUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    };
    window.addEventListener('user-profile-updated', syncUser);
    return () => window.removeEventListener('user-profile-updated', syncUser);
  }, []);

  React.useEffect(() => {
    const loadAdminAlerts = async () => {
      if (!showAlerts) return;
      setAlertsLoading(true);

      try {
        const token = getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${config.apiBaseUrl || ''}/api/v1/notifications/admin-alerts`, {
          method: 'GET',
          credentials: 'include',
          headers,
        });

        if (response.ok) {
          const payload = await response.json();
          setAdminAlerts(Array.isArray(payload?.alerts) ? payload.alerts : []);
          return;
        }
      } catch {
        // Fallback below keeps UI working even if alerts API is not available yet.
      }

      const cachedAlerts = JSON.parse(localStorage.getItem('admin_alerts') || '[]');
      setAdminAlerts(Array.isArray(cachedAlerts) ? cachedAlerts : []);
      setAlertsLoading(false);
    };

    loadAdminAlerts().finally(() => setAlertsLoading(false));
  }, [showAlerts]);

  const handleLogout = async () => {
    try {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await fetch(`${config.apiBaseUrl || ''}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {
      // Continue local cleanup even if API logout fails.
    }

    clearTokens();
    localStorage.removeItem('user');
    window.location.href = 'http://localhost:5173/';
  };

  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 32px',
      backgroundColor: theme.colors.bg.primary,
      borderBottom: `1px solid ${theme.colors.ui.border}`,
      transition: 'background-color 0.3s, border-color 0.3s',
      boxShadow: theme.isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.08)',
    }}>

      {/* Left - Title */}
      <div>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: theme.colors.text.primary, letterSpacing: '-0.5px' }}>
          {folderName || 'NeuraNote'}
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.colors.text.tertiary, fontWeight: '500' }}>
          Organize and manage your study materials
        </p>
      </div>

      {/* Right - Search + icons + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: theme.colors.ui.input, borderRadius: '10px',
          padding: '8px 14px',
          transition: 'background-color 0.3s',
        }}>
          <Search size={16} color={theme.colors.text.tertiary} />
          <input
            placeholder="Search Notes..."
            style={{
              border: 'none', background: 'none', outline: 'none',
              fontSize: '14px', color: theme.colors.text.primary, width: '180px',
              transition: 'color 0.3s',
            }}
          />
        </div>

        {/* Notification Bell */}
        <NotificationBell size={18} color={theme.colors.text.secondary} />

        {/* Admin Alerts */}
        <div style={{ position: 'relative' }}>
          <div
            style={iconButtonStyle}
            onClick={() => {
              setShowAlerts((prev) => !prev);
              setShowNotifications(false);
            }}
            title="Admin Alerts"
          >
            <ShieldAlert size={18} color={theme.colors.text.secondary} />
            {adminAlerts.length > 0 && (
              <div style={{
                position: 'absolute', top: '5px', right: '5px',
                minWidth: '14px', height: '14px', borderRadius: '7px',
                padding: '0 4px',
                backgroundColor: '#d14343',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
              }}>
                {adminAlerts.length}
              </div>
            )}
          </div>

          {showAlerts && (
            <div style={popoverStyle}>
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.colors.ui.border}`, fontWeight: 600, fontSize: '13px', color: theme.colors.text.primary }}>
                Admin Alerts
              </div>

              {alertsLoading ? (
                <div style={{ padding: '12px', fontSize: '13px', color: theme.colors.text.secondary }}>
                  Loading alerts...
                </div>
              ) : adminAlerts.length === 0 ? (
                <div style={{ padding: '12px', fontSize: '13px', color: theme.colors.text.secondary }}>
                  No admin alerts available.
                </div>
              ) : (
                adminAlerts.map((alert, index) => (
                  <div
                    key={String(alert?.id || index)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: index === adminAlerts.length - 1 ? 'none' : `1px solid ${theme.colors.ui.border}`,
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: theme.colors.text.primary }}>
                      {alert?.title || 'Admin Message'}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: theme.colors.text.secondary, lineHeight: 1.4 }}>
                      {alert?.message || 'No message body'}
                    </div>
                    {alert?.sent_at && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: theme.colors.text.tertiary }}>
                        {new Date(alert.sent_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <div
          onClick={toggleTheme}
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: theme.colors.ui.input, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.3s',
          }}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} color={theme.colors.accent} /> : <Moon size={18} color={theme.colors.text.secondary} />}
        </div>

        {/* Profile + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: theme.colors.text.primary, transition: 'color 0.3s' }}>
              {user?.full_name || user?.email || 'User'}
            </span>
            <span style={{ fontSize: '11px', color: theme.colors.text.secondary, transition: 'color 0.3s' }}>
              {user?.email ? user.email.split('@')[0] : ''}
            </span>
          </div>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: '#6C5DD3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: '14px', overflow: 'hidden'
          }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              getUserInitials()
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              border: `1px solid ${theme.colors.ui.border}`,
              background: theme.colors.bg.secondary,
              color: theme.colors.text.primary,
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Logout"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>

      </div>
    </div>
  );
};

export default TopBar;