import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, Activity, Cpu, Shield, Search,
  Pencil, Trash2, X, Plus, Radio, Send, Loader2, Lock,
  LayoutDashboard, AlertCircle, CheckCircle, Info, AlertTriangle
} from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import toast from '@/lib/simpleToast';

const SUPER_ADMIN_ID = "b422ac95-a9dd-4aa0-ab5c-54c09fa58267";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    total_users: 0,
    total_files: 0,
    active_sessions: 0,
    gemini_usage: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info' });
  const [isPosting, setIsPosting] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes, announcementsRes] = await Promise.all([
        axiosInstance.get('/api/v1/admin/users'),
        axiosInstance.get('/api/v1/admin/stats'),
        axiosInstance.get('/api/v1/admin/announcements')
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setAnnouncements(announcementsRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      console.error('Admin Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    setIsPosting(true);
    try {
      if (editingAnnouncement) {
        const res = await axiosInstance.patch(`/api/v1/admin/announcements/${editingAnnouncement.id}`, announcementForm);
        setAnnouncements(prev => prev.map(a => a.id === editingAnnouncement.id ? res.data : a));
      } else {
        const res = await axiosInstance.post('/api/v1/admin/announcements', announcementForm);
        setAnnouncements(prev => [res.data, ...prev]);
      }
      setAnnouncementForm({ title: '', content: '', type: 'info' });
      setEditingAnnouncement(null);
    } catch (err) {
      console.error('Announcement Error:', err);
    } finally {
      setIsPosting(false);
    }
  };

  const confirmDeleteAnnouncement = async (id, toastId) => {
    try {
      await axiosInstance.delete(`/api/v1/admin/announcements/${id}`);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.dismiss(toastId);
      toast.success('Announcement deleted');
    } catch (err) {
      console.error('Delete Error:', err);
      toast.dismiss(toastId);
      toast.error('Failed to delete announcement');
    }
  };

  const handleDeleteAnnouncement = (id) => {
    const tId = toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Delete this announcement?</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => { toast.dismiss(t.id); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #475569', background: 'transparent', color: '#cbd5e1' }}>Cancel</button>
          <button onClick={() => confirmDeleteAnnouncement(id, t.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff' }}>Delete</button>
        </div>
      </div>
    ), { duration: 60000 });
    return tId;
  };

  const handleRoleUpdate = async (userId, currentRole) => {
    if (userId === SUPER_ADMIN_ID) return;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await axiosInstance.patch(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      console.error('Role Update Error:', err);
      toast.error('Failed to update role');
    }
  };

  const confirmDeleteUser = async (userId, toastId) => {
    try {
      await axiosInstance.delete(`/api/v1/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.dismiss(toastId);
      toast.success('User deleted');
    } catch (err) {
      console.error('Delete user error:', err);
      toast.dismiss(toastId);
      toast.error('Failed to delete user');
    }
  };

  const handleDeleteUser = (userId) => {
    if (userId === SUPER_ADMIN_ID) return toast.error('Cannot delete super admin');
    const tId = toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px' }}>
        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>Delete this user?</div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>This action cannot be undone and will remove all associated data.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => confirmDeleteUser(userId, t.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    ), { duration: 60000, position: 'top-center' });
    return tId;
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    if (userId === SUPER_ADMIN_ID) return;
    const newStatus = currentStatus === 'suspended' ? 'approved' : 'suspended';
    try {
      await axiosInstance.patch(`/api/v1/admin/users/${userId}`, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error('Status toggle error:', err);
      alert('Failed to update user status');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getTypeIcon = (type) => {
    switch(type) {
      case 'urgent': return <AlertTriangle size={14} />;
      case 'warning': return <AlertCircle size={14} />;
      default: return <Info size={14} />;
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'urgent': return { bg: '#7f1d1d', text: '#fca5a5', border: '#7f1d1d' };
      case 'warning': return { bg: '#92400e', text: '#fcd34d', border: '#92400e' };
      default: return { bg: '#1e40af', text: '#93c5fd', border: '#1e40af' };
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={40} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      
      {/* Admin Sub-Sidebar */}
      <aside style={{
          width: '240px', backgroundColor: '#1e293b', borderRight: '1px solid #334155',
          display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
          zIndex: 50
        }}>
        {/* Header */}
        <div style={{
          padding: '20px 16px', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Shield size={18} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#f1f5f9', textTransform: 'uppercase' }}>Admin</h3>
            <p style={{ fontSize: '10px', color: '#94a3b8' }}>Control Panel</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
            { id: 'users', label: 'Users', icon: <Users size={16} /> },
            { id: 'broadcast', label: 'Broadcast', icon: <Radio size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#cbd5e1',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                fontWeight: '600', fontSize: '13px', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) e.target.style.backgroundColor = '#334155';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) e.target.style.backgroundColor = 'transparent';
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main style={{
        flex: 1, backgroundColor: '#0f172a', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', height: '100vh', width: '100%'
      }}>
        {/* Content Container with Scrolling */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', height: '100%', overflowX: 'hidden' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <header style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#1e40af', color: '#93c5fd', padding: '8px 16px',
                    borderRadius: '999px', fontSize: '12px', fontWeight: '700',
                    marginBottom: '12px', border: '1px solid #1e40af'
                  }}>
                    <Lock size={14} />
                    Secure Admin Access
                  </div>
                  <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#f1f5f9', marginBottom: '8px' }}>
                    Command Center
                  </h1>
                  <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
                    System health monitoring and infrastructure overview.
                  </p>
                </header>

                {/* Stats Grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px'
                }}>
                  {[
                    { icon: <Users size={20} />, label: 'Total Users', value: stats.total_users, color: '#3b82f6' },
                    { icon: <FileText size={20} />, label: 'System Files', value: stats.total_files, color: '#8b5cf6' },
                    { icon: <Activity size={20} />, label: 'Active Sessions', value: stats.active_sessions, color: '#10b981' },
                    { icon: <Cpu size={20} />, label: 'API Usage', value: `${stats.gemini_usage}%`, color: '#f59e0b' }
                  ].map((stat, i) => (
                    <div key={i} style={{
                      backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                      padding: '24px', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = '#475569';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#334155';
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ color: stat.color }}>{stat.icon}</div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
                          {stat.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: '900', color: '#f1f5f9' }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: USERS */}
            {activeTab === 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'calc(100vh - 100px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Users size={20} style={{ color: '#3b82f6' }} />
                    User Database
                  </h2>
                  <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={16} style={{
                      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                      color: '#475569'
                    }} />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      style={{
                        width: '100%', backgroundColor: '#1e293b', border: '1px solid #334155',
                        borderRadius: '8px', paddingLeft: '40px', paddingRight: '12px', paddingTop: '8px',
                        paddingBottom: '8px', fontSize: '13px', color: '#f1f5f9', outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#334155'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Users Table */}
                <div style={{
                  backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                  overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 10 }}>
                          <tr style={{ borderBottom: '1px solid #334155' }}>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Details</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role Status</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settings</th>
                          </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(user => (
                          <tr key={user.id} style={{
                            borderBottom: '1px solid #334155',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#33415544'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                {(user.profile_img || user.avatar_url) ? (
                                  <img
                                    src={user.profile_img || user.avatar_url}
                                    alt={user.full_name || user.email}
                                    style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid #334155' }}
                                  />
                                ) : (
                                  <div style={{
                                    width: '42px', height: '42px', borderRadius: '50%',
                                    backgroundColor: '#334155', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: '#cbd5e1', fontWeight: '700',
                                    fontSize: '15px', border: '2px solid #475569'
                                  }}>
                                    {user.full_name?.[0] || user.email[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '14px' }}>
                                    {user.full_name || 'System User'}
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                {user.role === 'admin' ? (
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                    color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)',
                                    textTransform: 'uppercase'
                                  }}>
                                    Admin
                                  </span>
                                ) : (
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)',
                                    textTransform: 'uppercase'
                                  }}>
                                    User
                                  </span>
                                )}
                                
                                {user.status === 'suspended' && (
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)',
                                    textTransform: 'uppercase'
                                  }}>
                                    Suspended
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                  onClick={() => handleRoleUpdate(user.id, user.role)}
                                  disabled={user.id === SUPER_ADMIN_ID}
                                  style={{
                                    padding: '8px', borderRadius: '8px', border: 'none', cursor: user.id === SUPER_ADMIN_ID ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent', color: '#94a3b8', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => { if (user.id !== SUPER_ADMIN_ID) e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.backgroundColor = '#334155'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  title="Change User Role"
                                >
                                  <Shield size={18} />
                                </button>

                                <button
                                  onClick={() => handleStatusToggle(user.id, user.status)}
                                  disabled={user.id === SUPER_ADMIN_ID}
                                  style={{
                                    padding: '8px', borderRadius: '8px', border: 'none', cursor: user.id === SUPER_ADMIN_ID ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent', color: '#94a3b8', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => { if (user.id !== SUPER_ADMIN_ID) e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.backgroundColor = '#334155'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  title={user.status === 'suspended' ? "Unsuspend" : "Suspend"}
                                >
                                  <AlertCircle size={18} />
                                </button>

                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={user.id === SUPER_ADMIN_ID}
                                  style={{
                                    padding: '8px', backgroundColor: 'transparent', border: 'none',
                                    borderRadius: '8px', color: '#94a3b8', cursor: user.id === SUPER_ADMIN_ID ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => { if (user.id !== SUPER_ADMIN_ID) e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#334155'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  title="Delete User"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BROADCAST */}
            {activeTab === 'broadcast' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                
                {/* Form */}
                <section>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Radio size={20} style={{ color: '#ef4444' }} />
                    Create Broadcast
                  </h2>
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
                    <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
                          Message Title
                        </label>
                        <input 
                          type="text" 
                          placeholder="E.g. System Maintenance"
                          style={{
                            width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155',
                            borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#f1f5f9',
                            outline: 'none', transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#334155'}
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
                          Announcement Details
                        </label>
                        <textarea 
                          rows="5"
                          placeholder="What do users need to know?"
                          style={{
                            width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155',
                            borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#f1f5f9',
                            outline: 'none', resize: 'none', transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#334155'}
                          value={announcementForm.content}
                          onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#334155', padding: '12px', borderRadius: '8px' }}>
                        <input 
                          type="checkbox"
                          id="urgent-toggle"
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          checked={announcementForm.type === 'urgent'}
                          onChange={(e) => setAnnouncementForm({...announcementForm, type: e.target.checked ? 'urgent' : 'info'})}
                        />
                        <label htmlFor="urgent-toggle" style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1', cursor: 'pointer' }}>
                          Mark as <span style={{ color: '#ef4444', fontWeight: '700' }}>URGENT</span>
                        </label>
                      </div>

                      <button 
                        type="submit"
                        disabled={isPosting}
                        style={{
                          width: '100%', backgroundColor: '#3b82f6', color: '#ffffff',
                          fontWeight: '700', padding: '12px', borderRadius: '8px', border: 'none',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '8px', transition: 'all 0.2s', opacity: isPosting ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isPosting) e.target.style.backgroundColor = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isPosting) e.target.style.backgroundColor = '#3b82f6';
                        }}
                      >
                        {isPosting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                        {editingAnnouncement ? 'Update Broadcast' : 'Post Broadcast'}
                      </button>
                      
                      {editingAnnouncement && (
                        <button 
                          type="button"
                          onClick={() => {
                            setEditingAnnouncement(null);
                            setAnnouncementForm({ title: '', content: '', type: 'info' });
                          }}
                          style={{
                            width: '100%', backgroundColor: '#334155', color: '#cbd5e1',
                            fontWeight: '600', padding: '10px', borderRadius: '8px', border: '1px solid #475569',
                            cursor: 'pointer', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#475569';
                            e.target.style.color = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#334155';
                            e.target.style.color = '#cbd5e1';
                          }}
                        >
                          Cancel Editing
                        </button>
                      )}
                    </form>
                  </div>
                </section>

                {/* List */}
                <section>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                    Recent Broadcasts
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto' }}>
                    {announcements.length === 0 ? (
                      <div style={{
                        backgroundColor: '#1e293b', border: '1px dashed #334155', borderRadius: '12px',
                        padding: '40px 24px', textAlign: 'center', color: '#475569'
                      }}>
                        No active announcements.
                      </div>
                    ) : (
                      announcements.map(item => {
                        const typeColor = getTypeColor(item.type);
                        return (
                          <div key={item.id} style={{
                            backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                            padding: '16px', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#475569';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#334155';
                            e.currentTarget.style.boxShadow = 'none';
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                  <h3 style={{ fontWeight: '700', color: '#f1f5f9', fontSize: '13px' }}>
                                    {item.title}
                                  </h3>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '2px 6px', borderRadius: '4px', fontSize: '10px',
                                    fontWeight: '700', textTransform: 'uppercase',
                                    backgroundColor: typeColor.bg, color: typeColor.text,
                                    border: `1px solid ${typeColor.border}`
                                  }}>
                                    {getTypeIcon(item.type)}
                                    {item.type || 'info'}
                                  </span>
                                </div>
                                <p style={{
                                  fontSize: '12px', color: '#cbd5e1',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: expandedId === item.id ? '500px' : '60px',
                                  overflow: expandedId === item.id ? 'visible' : 'hidden',
                                  textOverflow: 'ellipsis',
                                  transition: 'all 0.2s'
                                }}>
                                  {item.content}
                                </p>
                                {item.content && item.content.length > 100 && (
                                  <button 
                                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                    style={{
                                      marginTop: '8px', fontSize: '11px', fontWeight: '700',
                                      color: '#3b82f6', backgroundColor: 'transparent', border: 'none',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {expandedId === item.id ? 'Show Less' : 'Read More'}
                                  </button>
                                )}
                                <div style={{ marginTop: '8px', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: '600' }}>
                                  {new Date(item.created_at).toLocaleString()}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <button 
                                  onClick={() => {
                                    setEditingAnnouncement(item);
                                    setAnnouncementForm({ title: item.title, content: item.content, type: item.type || 'info' });
                                  }}
                                  style={{
                                    padding: '6px', backgroundColor: 'transparent', border: 'none',
                                    cursor: 'pointer', color: '#3b82f6', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.color = '#60a5fa'}
                                  onMouseLeave={(e) => e.target.style.color = '#3b82f6'}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteAnnouncement(item.id)}
                                  style={{
                                    padding: '6px', backgroundColor: 'transparent', border: 'none',
                                    cursor: 'pointer', color: '#ef4444', transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.color = '#f87171'}
                                  onMouseLeave={(e) => e.target.style.color = '#ef4444'}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
