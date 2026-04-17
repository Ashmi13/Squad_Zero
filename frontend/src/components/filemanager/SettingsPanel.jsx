import React, { useState } from 'react';
import { X, User, Palette, Bot, Lock, Upload, HardDrive, CreditCard} from 'lucide-react';

const SettingsPanel = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('profile');
  const [displayName, setDisplayName] = useState('Sarah Johnson');
  const [email, setEmail] = useState('sarah@example.com');
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('Medium');
  const [responseStyle, setResponseStyle] = useState('Simple');
  const [tone, setTone] = useState('Friendly');
  const [reminder, setReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [saveChatHistory, setSaveChatHistory] = useState(true);
  const [profilePic, setProfilePic] = useState(null);

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'ai', label: 'AI Preferences', icon: Bot },
     { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'privacy', label: 'Privacy', icon: Lock },
  ];

  const Toggle = ({ value, onChange }) => (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: '44px', height: '24px',
        borderRadius: '12px',
        backgroundColor: value ? '#6C5DD3' : '#ddd',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '3px',
        left: value ? '23px' : '3px',
        width: '18px', height: '18px',
        borderRadius: '50%',
        backgroundColor: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
      }} />
    </div>
  );

  const SectionButton = ({ id, label, icon: Icon }) => (
    <div
      onClick={() => setActiveSection(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', cursor: 'pointer', borderRadius: '10px',
        backgroundColor: activeSection === id ? '#f0eeff' : 'transparent',
        color: activeSection === id ? '#6C5DD3' : '#555',
        fontWeight: activeSection === id ? '600' : '400',
        fontSize: '14px',
      }}
    >
      <Icon size={17} />
      {label}
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {

      case 'profile':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>👤 Profile</h3>

            {/* Profile picture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                backgroundColor: '#6C5DD3',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '24px', fontWeight: '700',
                overflow: 'hidden'
              }}>
                {profilePic
                  ? <img src={profilePic} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : displayName.charAt(0)
                }
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#f0eeff', color: '#6C5DD3',
                padding: '8px 14px', borderRadius: '10px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600'
              }}>
                <Upload size={14} /> Upload Photo
                <input type="file" hidden accept="image/*" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) setProfilePic(URL.createObjectURL(file));
                }} />
              </label>
            </div>

            {/* Display name */}
            <div>
              <label style={{ fontSize: '13px', color: '#888', fontWeight: '600' }}>Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: '6px',
                  padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #eee', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: '13px', color: '#888', fontWeight: '600' }}>Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  display: 'block', width: '100%', marginTop: '6px',
                  padding: '10px 14px', borderRadius: '10px',
                  border: '1px solid #eee', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button style={{
              backgroundColor: '#6C5DD3', color: 'white',
              border: 'none', borderRadius: '10px',
              padding: '10px 20px', cursor: 'pointer',
              fontSize: '14px', fontWeight: '600', alignSelf: 'flex-start'
            }}>
              Save Changes
            </button>
          </div>
        );

      case 'appearance':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>🎨 Appearance</h3>

            {/* Dark mode */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Dark Mode</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>Switch to dark theme</p>
              </div>
              <Toggle value={darkMode} onChange={setDarkMode} />
            </div>

            {/* Font size */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Font Size</p>
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

      case 'ai':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>🤖 AI Preferences</h3>

            {/* Response style */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Response Style</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Simple', 'Detailed'].map(style => (
                  <button
                    key={style}
                    onClick={() => setResponseStyle(style)}
                    style={{
                      padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                      border: '1px solid #eee', fontSize: '13px', fontWeight: '600',
                      backgroundColor: responseStyle === style ? '#6C5DD3' : 'white',
                      color: responseStyle === style ? 'white' : '#555',
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Tone</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['Friendly', 'Formal'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    style={{
                      padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                      border: '1px solid #eee', fontSize: '13px', fontWeight: '600',
                      backgroundColor: tone === t ? '#6C5DD3' : 'white',
                      color: tone === t ? 'white' : '#555',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>🔔 Notifications</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Study Reminder</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>Get reminded to study daily</p>
              </div>
              <Toggle value={reminder} onChange={setReminder} />
            </div>

            {reminder && (
              <div>
                <label style={{ fontSize: '13px', color: '#888', fontWeight: '600' }}>Reminder Time</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  style={{
                    display: 'block', marginTop: '6px',
                    padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid #eee', fontSize: '14px', outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'privacy':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>🔒 Privacy</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Save Chat History</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>Store your conversations</p>
              </div>
              <Toggle value={saveChatHistory} onChange={setSaveChatHistory} />
            </div>

            <div>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '600', color: '#1a1a2e' }}>Delete All Chat History</p>
              <button
                onClick={() => confirm('Are you sure? This cannot be undone.') && alert('Chat history deleted!')}
                style={{
                  backgroundColor: '#fff0f0', color: '#e74c3c',
                  border: '1px solid #ffd0d0', borderRadius: '10px',
                  padding: '10px 20px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '600',
                }}
              >
                🗑 Delete All History
              </button>
            </div>
          </div>
        );

        case 'storage':
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>🗄️ Storage</h3>

      {/* Plan badge */}
      <div style={{
        backgroundColor: '#f0eeff', borderRadius: '12px', padding: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: '700', color: '#6C5DD3', fontSize: '15px' }}>Free Plan</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>500 MB storage on AWS</p>
        </div>
        <span style={{
          backgroundColor: '#6C5DD3', color: 'white',
          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
        }}>FREE</span>
      </div>

      {/* Storage bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a2e' }}>Storage Used</span>
          <span style={{ fontSize: '13px', color: '#888' }}>120 MB / 500 MB</span>
        </div>
        <div style={{ backgroundColor: '#f0f0f0', borderRadius: '10px', height: '10px' }}>
          <div style={{
            width: '24%', height: '100%',
            backgroundColor: '#6C5DD3', borderRadius: '10px'
          }} />
        </div>
        <p style={{ fontSize: '12px', color: '#aaa', marginTop: '6px' }}>24% used — 380 MB remaining</p>
      </div>

      {/* Upgrade prompt */}
      <div style={{
        border: '1px solid #eee', borderRadius: '12px', padding: '16px',
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '14px', color: '#1a1a2e' }}>Need more storage?</p>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#aaa' }}>Upgrade to Pro for 10 GB on AWS Cloud</p>
        <button style={{
          backgroundColor: '#6C5DD3', color: 'white', border: 'none',
          borderRadius: '10px', padding: '10px 20px',
          cursor: 'pointer', fontSize: '14px', fontWeight: '600'
        }}>
          Upgrade to Pro ✨
        </button>
      </div>
    </div>
  );

case 'payment':
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>💳 Payment</h3>

      {/* Current plan */}
      <div style={{
        backgroundColor: '#f9f9f9', borderRadius: '12px', padding: '16px',
        border: '1px solid #eee'
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#1a1a2e' }}>Current Plan: Free</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>500 MB storage · Basic features</p>
      </div>

      {/* Plans */}
      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#888' }}>UPGRADE YOUR PLAN</p>

      {[
        { name: 'Pro', price: '$5/month', storage: '10 GB', features: 'All features + Priority support' },
        { name: 'Premium', price: '$12/month', storage: '50 GB', features: 'All Pro + AI features + Team access' },
      ].map(plan => (
        <div key={plan.name} style={{
          border: '1px solid #e0d9ff', borderRadius: '12px', padding: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#1a1a2e', fontSize: '15px' }}>
              {plan.name} — {plan.price}
            </p>
            <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#888' }}>{plan.storage} AWS Cloud Storage</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>{plan.features}</p>
          </div>
          <button style={{
            backgroundColor: '#6C5DD3', color: 'white', border: 'none',
            borderRadius: '10px', padding: '8px 16px',
            cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            Choose {plan.name}
          </button>
        </div>
      ))}

      {/* Payment method */}
      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#888' }}>PAYMENT METHOD</p>
      <div style={{
        border: '1px solid #eee', borderRadius: '12px', padding: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '26px', backgroundColor: '#1a1a2e',
            borderRadius: '6px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: '700'
          }}>VISA</div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1a1a2e' }}>No card added</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>Add a payment method to upgrade</p>
          </div>
        </div>
        <button style={{
          backgroundColor: 'white', color: '#6C5DD3',
          border: '1px solid #6C5DD3', borderRadius: '10px',
          padding: '8px 14px', cursor: 'pointer',
          fontSize: '13px', fontWeight: '600'
        }}>
          + Add Card
        </button>
      </div>
    </div>
  );

      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        width: '700px', height: '500px',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>

        {/* Left sidebar */}
        <div style={{
          width: '200px', backgroundColor: '#fafafa',
          borderRight: '1px solid #f0f0f0',
          padding: '20px 12px',
          display: 'flex', flexDirection: 'column', gap: '4px'
        }}>
          <p style={{ fontSize: '12px', color: '#aaa', fontWeight: '600', margin: '0 0 12px 8px' }}>SETTINGS</p>
          {sections.map(s => <SectionButton key={s.id} {...s} />)}
        </div>

        {/* Right content */}
        <div style={{ flex: 1, padding: '28px', overflowY: 'auto', position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'none', border: 'none', cursor: 'pointer'
            }}
          >
            <X size={20} color="#aaa" />
          </button>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;