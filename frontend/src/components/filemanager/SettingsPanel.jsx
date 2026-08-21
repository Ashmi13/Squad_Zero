import React, { useEffect, useState } from 'react';
import { X, User, Palette, Upload, HardDrive } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { config } from '@/config/env';
import { getAccessToken, clearTokens } from '@/utils/tokenStorage';
import { workspaceApi } from '@/services/workspaceApi';

const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_GB = 1024 * BYTES_PER_MB;

const formatStorageValue = (bytes) => {
  const value = Number(bytes) || 0;
  if (value >= BYTES_PER_GB) {
    return `${Math.round((value / BYTES_PER_GB) * 100) / 100} GB`;
  }
  return `${Math.round((value / BYTES_PER_MB) * 100) / 100} MB`;
};

const SettingsPanel = ({ onClose }) => {
  const { isDark, toggleTheme, theme, fontSize, setFontSize } = useTheme();
  const [activeSection, setActiveSection] = useState('profile');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [reminder, setReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [profilePic, setProfilePic] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [storageUsage, setStorageUsage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [payhereLoading, setPayhereLoading] = useState(false);
  const [payhereError, setPayhereError] = useState('');

  const request = async (path, options = {}) => {
    const token = getAccessToken();
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${config.apiBaseUrl || ''}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    if (!response.ok) {
      let detail = 'Request failed';
      try {
        const body = await response.json();
        detail = body?.detail || JSON.stringify(body);
      } catch {
        // ignored
      }
      throw new Error(detail);
    }

    return response.json();
  };

  const syncUserToLocalStorage = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('user-profile-updated'));
  };

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (localUser?.full_name || localUser?.email || localUser?.avatar_url) {
      setDisplayName(localUser.full_name || '');
      setEmail(localUser.email || '');
      setProfilePic(localUser.avatar_url || null);
    }

    const loadProfile = async () => {
      try {
        const profile = await request('/api/v1/auth/me');
        setDisplayName(profile.full_name || '');
        setEmail(profile.email || '');
        setProfilePic(profile.avatar_url || null);
        syncUserToLocalStorage(profile);
      } catch (err) {
        if ((err.message || '').toLowerCase().includes('not authenticated')) {
          clearTokens();
        }
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    if (activeSection !== 'storage') return undefined;

    let isMounted = true;
    const loadStorageUsage = () => {
      setStorageLoading(true);
      setStorageError('');
      workspaceApi.getStorageUsage()
        .then((usage) => {
          if (isMounted) setStorageUsage(usage);
        })
        .catch((err) => {
          if (isMounted) setStorageError(err.message || 'Failed to load storage usage');
        })
        .finally(() => {
          if (isMounted) setStorageLoading(false);
        });
    };

    loadStorageUsage();
    window.addEventListener('neuranote:payment-status-updated', loadStorageUsage);
    window.addEventListener('focus', loadStorageUsage);

    return () => {
      isMounted = false;
      window.removeEventListener('neuranote:payment-status-updated', loadStorageUsage);
      window.removeEventListener('focus', loadStorageUsage);
    };
  }, [activeSection]);

  const handleProUpgrade = async () => {
    setPayhereLoading(true);
    setPayhereError('');

    try {
      const checkout = await workspaceApi.createPayHereCheckout();
      if (!checkout?.checkout_url || !checkout?.fields) {
        throw new Error('The payment checkout could not be prepared. Please try again.');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = checkout.checkout_url;
      form.style.display = 'none';

      Object.entries(checkout.fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value ?? '');
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      if (err.code === 'active_pro_subscription') {
        const expiry = err.expiresAt ? new Date(err.expiresAt).toLocaleDateString() : 'the current expiry date';
        setPayhereError(`You already have an active Pro account. Your Pro plan is valid until ${expiry}.`);
      } else {
        setPayhereError(err.message || 'Unable to start checkout. Please try again.');
      }
      setPayhereLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setSavingProfile(true);
    setProfileError('');
    try {
      const updated = await request('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: displayName.trim() || 'User' }),
      });
      setDisplayName(updated.full_name || displayName);
      setEmail(updated.email || email);
      setProfilePic(updated.avatar_url || profilePic);
      syncUserToLocalStorage(updated);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type && !file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (JPG, PNG, WebP, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setProfileError('Image file size must be under 10MB');
      return;
    }

    setProfileError('');
    setUploadingImage(true);
    const previousPic = profilePic;
    const localPreview = URL.createObjectURL(file);
    setProfilePic(localPreview);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const updated = await request('/api/v1/auth/profile/image', {
        method: 'POST',
        body: formData,
      });
      const newAvatar = updated?.avatar_url || localPreview;
      setProfilePic(newAvatar);
      setDisplayName(updated?.full_name || displayName);
      setEmail(updated?.email || email);
      syncUserToLocalStorage(updated);
    } catch (err) {
      setProfilePic(previousPic);
      setProfileError(err.message || 'Failed to upload profile image');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'storage', label: 'Storage', icon: HardDrive },
  ];

  const Toggle = ({ value, onChange }) => (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '48px', height: '28px',
        borderRadius: '14px',
        backgroundColor: value ? theme.colors.accent : theme.colors.ui.border,
        cursor: 'pointer', position: 'relative',
        transition: 'background-color 0.3s ease'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '4px',
        left: value ? '26px' : '4px',
        width: '20px', height: '20px',
        borderRadius: '50%',
        backgroundColor: 'white',
        transition: 'left 0.3s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }} />
    </div>
  );

  const SectionButton = ({ id, label, icon }) => (
    <div
      onClick={() => setActiveSection(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', cursor: 'pointer', borderRadius: '10px',
        backgroundColor: activeSection === id ? theme.colors.ui.hover : 'transparent',
        color: activeSection === id ? theme.colors.accent : theme.colors.text.secondary,
        fontWeight: activeSection === id ? '600' : '500',
        fontSize: '14px',
      }}
    >
      {React.createElement(icon, { size: 18 })}
      {label}
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {

      case 'profile':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: theme.colors.text.primary }}>👤 Profile</h3>

            {/* Profile picture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                backgroundColor: theme.colors.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '28px', fontWeight: '700',
                overflow: 'hidden',
                boxShadow: `0 4px 12px rgba(91, 79, 184, 0.3)`
              }}>
                {profilePic
                  ? <img src={profilePic} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (displayName || 'U').charAt(0).toUpperCase()
                }
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#f0eeff', color: '#6C5DD3',
                padding: '8px 14px', borderRadius: '10px',
                cursor: uploadingImage ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '600',
                opacity: uploadingImage ? 0.7 : 1,
              }}>
                <Upload size={14} /> {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/*"
                  disabled={uploadingImage}
                  onChange={handleImageUpload}
                />
              </label>
            </div>

            {profileError && (
              <p style={{ margin: 0, color: '#d14343', fontSize: '12px' }}>{profileError}</p>
            )}

            {/* Display name */}
            <div>
              <label style={{ fontSize: '13px', color: theme.colors.text.secondary, fontWeight: '600' }}>Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: '8px',
                  padding: '12px 14px', borderRadius: '10px',
                  border: `1.5px solid ${theme.colors.ui.border}`, fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', backgroundColor: theme.colors.bg.secondary, color: theme.colors.text.primary,
                  transition: 'all 0.3s',
                }}
                onFocus={(e) => e.target.style.borderColor = theme.colors.accent}
                onBlur={(e) => e.target.style.borderColor = theme.colors.ui.border}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: '13px', color: theme.colors.text.secondary, fontWeight: '600' }}>Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: '8px',
                  padding: '12px 14px', borderRadius: '10px',
                  border: `1.5px solid ${theme.colors.ui.border}`, fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', backgroundColor: theme.colors.bg.secondary, color: theme.colors.text.primary,
                  transition: 'all 0.3s',
                }}
                onFocus={(e) => e.target.style.borderColor = theme.colors.accent}
                onBlur={(e) => e.target.style.borderColor = theme.colors.ui.border}
              />
            </div>

            <button
            onClick={handleProfileSave}
            disabled={savingProfile}
            style={{
              backgroundColor: theme.colors.accent, color: 'white',
              border: 'none', borderRadius: '10px',
              padding: '12px 24px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '600', alignSelf: 'flex-start',
              transition: 'all 0.3s ease',
              opacity: savingProfile ? 0.7 : 1,
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = theme.colors.accentLight}
            onMouseLeave={(e) => e.target.style.backgroundColor = theme.colors.accent}
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        );

      case 'appearance':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: theme.colors.text.primary }}>🎨 Appearance</h3>

            {/* Dark mode */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '10px', backgroundColor: theme.colors.bg.secondary, transition: 'all 0.3s' }}>
              <div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: theme.colors.text.primary }}>Dark Mode</p>
                <p style={{ margin: 0, fontSize: '12px', color: theme.colors.text.secondary }}>Switch to dark theme</p>
              </div>
              <Toggle value={isDark} onChange={toggleTheme} />
            </div>

            {/* Font size */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: theme.colors.text.primary }}>Font Size</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Small', 'Medium', 'Large'].map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    style={{
                      padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                      border: '1px solid #eee', fontSize: '13px', fontWeight: '600',
                      backgroundColor: fontSize === size ? '#6C5DD3' : 'white',
                      color: fontSize === size ? 'white' : '#555',
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>🔔 Notifications</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: theme.colors.text.primary }}>Study Reminder</p>
                <p style={{ margin: 0, fontSize: '12px', color: theme.colors.text.secondary }}>Get reminded to study daily</p>
              </div>
              <Toggle value={reminder} onChange={setReminder} />
            </div>

            {reminder && (
              <div>
                <label style={{ fontSize: '13px', color: theme.colors.text.secondary, fontWeight: '600' }}>Reminder Time</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  style={{
                    display: 'block', marginTop: '6px',
                    padding: '10px 14px', borderRadius: '10px',
                    border: `1px solid ${theme.colors.ui.border}`, fontSize: '14px', outline: 'none',
                    backgroundColor: theme.colors.bg.secondary, color: theme.colors.text.primary, transition: 'all 0.3s',
                  }}
                />
              </div>
            )}
          </div>
        );

        case 'storage':
  {
    const storageLimitBytes = Number(storageUsage?.storage_limit_bytes) || 0;
    const storageUsedBytes = Number(storageUsage?.storage_used_bytes) || 0;
    const storageRemainingBytes = Math.max(
      Number(storageUsage?.storage_remaining_bytes) || storageLimitBytes - storageUsedBytes,
      0,
    );
    const storagePercentage = storageLimitBytes > 0
      ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))
      : 0;
    const planName = storageUsage?.plan_name || 'Loading...';
    const isPro = (storageUsage?.plan_code || '').toLowerCase() === 'pro';

    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: theme.colors.text.primary }}>🗄️ Storage</h3>

      {/* Plan badge */}
      <div style={{
        backgroundColor: theme.isDark ? 'rgba(91, 79, 184, 0.12)' : 'rgba(91, 79, 184, 0.08)', borderRadius: '12px', padding: '20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.3s', border: `1px solid ${theme.colors.accent}20`,
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: '700', color: theme.colors.accent, fontSize: '16px' }}>{isPro ? 'Pro Account' : `${planName} Plan`}</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.colors.text.secondary }}>{storageUsage ? `${formatStorageValue(storageLimitBytes)} storage on AWS` : 'Loading storage plan...'}</p>
          {isPro && storageUsage?.subscription_expires_at && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: theme.colors.text.secondary }}>
              Active until {new Date(storageUsage.subscription_expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <span style={{
          backgroundColor: theme.colors.accent, color: 'white',
          padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
        }}>{storageUsage ? (storageUsage.plan_code || '').toUpperCase() : '...'}</span>
      </div>

      {/* Storage bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a2e' }}>Storage Used</span>
          <span style={{ fontSize: '13px', color: '#888' }}>
            {storageLoading ? 'Loading...' : `${formatStorageValue(storageUsedBytes)} / ${formatStorageValue(storageLimitBytes)}`}
          </span>
        </div>
        <div style={{ backgroundColor: theme.colors.ui.border, borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
          <div style={{
            width: `${storagePercentage}%`, height: '100%',
            backgroundColor: theme.colors.accent, borderRadius: '10px',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <p style={{ fontSize: '12px', color: theme.colors.text.tertiary, marginTop: '8px', fontWeight: '500' }}>
          {storageError || `${storagePercentage}% used — ${formatStorageValue(storageRemainingBytes)} remaining`}
        </p>
      </div>

      {/* Upgrade prompt */}
      <div style={{
        border: `1.5px solid ${theme.colors.ui.border}`, borderRadius: '12px', padding: '20px',
        backgroundColor: theme.colors.bg.secondary, transition: 'all 0.3s'
      }}>
        <p style={{ margin: '0 0 6px', fontWeight: '600', fontSize: '15px', color: theme.colors.text.primary }}>{isPro ? 'Pro subscription active' : 'Need more storage?'}</p>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: theme.colors.text.secondary, fontWeight: '500' }}>
          {isPro ? `You already have an active Pro subscription until ${new Date(storageUsage.subscription_expires_at).toLocaleDateString()}.` : 'Upgrade to Pro for more storage'}
        </p>
        {payhereError && (
          <p style={{ margin: '0 0 12px', color: '#d14343', fontSize: '12px' }}>{payhereError}</p>
        )}
        {!isPro && <button style={{
          backgroundColor: theme.colors.accent, color: 'white', border: 'none',
          borderRadius: '10px', padding: '12px 20px',
          cursor: payhereLoading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600',
          opacity: payhereLoading ? 0.7 : 1,
          transition: 'all 0.3s ease'
        }}
        disabled={payhereLoading}
        onMouseEnter={(e) => e.target.style.backgroundColor = theme.colors.accentLight}
        onMouseLeave={(e) => e.target.style.backgroundColor = theme.colors.accent}
        onClick={handleProUpgrade}
        >
          {payhereLoading ? 'Preparing checkout...' : 'Upgrade to Pro ✨'}
        </button>}
      </div>
    </div>
    );
  }

      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: theme.colors.bg.primary,
        borderRadius: '20px',
        width: '700px', height: '500px',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: theme.isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)',
        transition: 'background-color 0.3s, box-shadow 0.3s',
      }}>

        {/* Left sidebar */}
        <div style={{
          width: '200px', backgroundColor: theme.colors.bg.secondary,
          borderRight: `1px solid ${theme.colors.ui.border}`,
          transition: 'background-color 0.3s, border-color 0.3s',
          padding: '24px 12px',
          display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
          <p style={{ fontSize: '11px', color: theme.colors.text.tertiary, fontWeight: '700', margin: '0 0 16px 12px', letterSpacing: '0.5px' }}>SETTINGS</p>
          {sections.map(s => <SectionButton key={s.id} {...s} />)}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto', position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              transition: 'background-color 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.colors.ui.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={22} color={theme.colors.text.secondary} strokeWidth={2} />
          </button>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;