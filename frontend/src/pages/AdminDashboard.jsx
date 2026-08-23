import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, Activity, Cpu, Shield, Search,
  Pencil, Trash2, X, Plus, Radio, Send, Loader2, Lock,
  LayoutDashboard, AlertCircle, CheckCircle, Info, AlertTriangle,ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import toast from '@/lib/simpleToast';
import { motion } from 'framer-motion';
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
        // Ensure we immediately see the new announcement at the top
        setAnnouncements(prev => [res.data, ...prev]);
      }
      // Reset form and UI state
      setAnnouncementForm({ title: '', content: '', type: 'info' });
      setEditingAnnouncement(null);
      
      // Optional: switch to broadcast tab if they aren't there
      setActiveTab('broadcast'); 
      
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

  const handleStatusToggle = async (userId, currentIsSuspended) => {
    if (userId === SUPER_ADMIN_ID) return;
    const nextSuspended = !Boolean(currentIsSuspended);
    try {
      await axiosInstance.patch(`/api/v1/admin/users/${userId}/suspend`, { is_suspended: nextSuspended });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: nextSuspended } : u));
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
      {/* Admin Sub-Sidebar */}
      {/* Admin Sub-Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          zIndex: 50,
          boxShadow: '4px 0 24px rgba(149, 157, 165, 0.05)',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)'
            }}
          >
            <Shield size={20} color="#ffffff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: '800',
                color: '#0f172a',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                margin: 0
              }}
            >
              Admin Panel
            </h3>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: '500' }}>
              Control Center
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          style={{
            flex: 1,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          {[
            { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
            { id: 'users', label: 'Users', icon: <Users size={18} /> },
            { id: 'broadcast', label: 'Broadcast', icon: <Radio size={18} /> }
          ].map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  position: 'relative',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isActive ? '#f0f9ff' : 'transparent',
                  color: isActive ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '14px',
                  transition: 'all 0.2s ease-in-out',
                  outline: 'none',
                  borderLeft: isActive ? '4px solid #0ea5e9' : '4px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.color = '#334155';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: isActive ? '#0ea5e9' : '#94a3b8' }}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </div>

                {isActive && <ChevronRight size={16} color="#0284c7" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          backgroundColor: '#f8fafc', // Clean Light Off-White Background Base
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100%',
          position: 'relative',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}
      >
        {/* Background Logo Watermark (Centred on the entire page/main content area behind everything) */}
        {activeTab === 'overview' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(500px, 80vw)',
            height: 'min(500px, 80vw)',
            backgroundImage: 'url("/logo.png")',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.4,
            pointerEvents: 'none',
            zIndex: 0
          }} />
        )}

        {/* Content Container with Smooth Scrolling */}
        <div
          className="main-content-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '36px 48px',
            height: '100%',
            overflowX: 'hidden',
            scrollBehavior: 'smooth',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div
            style={{
              maxWidth: '1400px',
              margin: '0 auto',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '32px'
            }}
          >
            {/* Ungaloda Overview / Users / Broadcast dynamic components inga load aagum */}

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* Header */}
                <header style={{ textAlign: 'center', padding: '8px 0 12px 0' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      padding: '6px 16px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '700',
                      marginBottom: '16px',
                      border: '1px solid #bae6fd'
                    }}
                  >
                    <Lock size={14} />
                    <span>Secure Admin Access</span>
                  </div>

                  <h1
                    style={{
                      fontSize: '72px',
                      fontWeight: '800',
                      color: '#0f172a',
                      marginBottom: '8px',
                      letterSpacing: '-0.5px'
                    }}
                  >
                    NeuroNote Command Center
                  </h1>

                  <p
                    style={{
                      fontSize: '14px',
                      color: '#64748b',
                      maxWidth: '560px',
                      margin: '0 auto',
                      lineHeight: '1.6'
                    }}
                  >
                    System health monitoring and infrastructure overview.
                  </p>
                </header>

                {/* Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '24px'
                  }}
                >
                  {[
                    {
                      icon: <Users size={22} />,
                      label: 'Total Users',
                      value: stats.total_users,
                      bgColor: '#e0f2fe',
                      iconColor: '#0284c7'
                    },
                    {
                      icon: <FileText size={22} />,
                      label: 'System Files',
                      value: stats.total_files,
                      bgColor: '#f3e8ff',
                      iconColor: '#9333ea'
                    },
                    {
                      icon: <Radio size={22} />,
                      label: 'Total Announcements',
                      value: stats.total_announcements || announcements.length,
                      bgColor: '#fef2f2',
                      iconColor: '#ef4444'
                    }
                  ].map((stat, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '24px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease-in-out',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = '#bae6fd';
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(14, 165, 233, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.03)';
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '16px'
                          }}
                        >
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              backgroundColor: stat.bgColor,
                              color: stat.iconColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {stat.icon}
                          </div>

                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.6px'
                            }}
                          >
                            {stat.label}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '32px',
                          fontWeight: '800',
                          color: '#0f172a',
                          letterSpacing: '-0.5px'
                        }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: USERS */}
            {/* TAB: USERS */}
            {activeTab === 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 'calc(100vh - 120px)' }}>
                
                {/* Top Bar: Title & Search Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={20} style={{ color: '#0284c7' }} />
                    </div>
                    User Database
                  </h2>

                  {/* Search Input Box */}
                  <div style={{ position: 'relative', width: '320px' }}>
                    <Search size={16} style={{
                      position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                      color: '#94a3b8'
                    }} />
                    <input 
                      type="text" 
                      placeholder="Search users by name or email..." 
                      style={{
                        width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1',
                        borderRadius: '10px', paddingLeft: '40px', paddingRight: '14px', paddingTop: '10px',
                        paddingBottom: '10px', fontSize: '13px', color: '#0f172a', outline: 'none',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)', transition: 'all 0.2s ease-in-out'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#0ea5e9';
                        e.target.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#cbd5e1';
                        e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
                      }}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Users Table Card */}
                <div style={{
                  backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
                  overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
                }}>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAliign: 'left' }}>
                      
                      {/* Table Header */}
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>User Details</th>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Role Status</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Settings</th>
                        </tr>
                      </thead>

                      {/* Table Body */}
                      <tbody>
                        {filteredUsers.map(user => (
                          <tr key={user.id} style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            
                            {/* User Info Column */}
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                {(user.profile_img || user.avatar_url) ? (
                                  <img
                                    src={user.profile_img || user.avatar_url}
                                    alt={user.full_name || user.email}
                                    style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }}
                                  />
                                ) : (
                                  <div style={{
                                    width: '42px', height: '42px', borderRadius: '50%',
                                    backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', color: '#0284c7', fontWeight: '700',
                                    fontSize: '15px', border: '1px solid #bae6fd'
                                  }}>
                                    {user.full_name?.[0] || user.email[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                                    {user.full_name || 'System User'}
                                  </div>
                                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{user.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Role & Status Column */}
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                {user.role === 'admin' ? (
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a',
                                    textTransform: 'uppercase'
                                  }}>
                                    Admin
                                  </span>
                                ) : (
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd',
                                    textTransform: 'uppercase'
                                  }}>
                                    User
                                  </span>
                                )}
                                
                                {Boolean(user.is_suspended) && (
                                  <span style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                    textTransform: 'uppercase'
                                  }}>
                                    Suspended
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions Column */}
                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                
                                {/* Role Button */}
                                <button
                                  onClick={() => handleRoleUpdate(user.id, user.role)}
                                  disabled={user.id === SUPER_ADMIN_ID}
                                  style={{
                                    padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: user.id === SUPER_ADMIN_ID ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#ffffff', color: '#64748b', transition: 'all 0.2s', opacity: user.id === SUPER_ADMIN_ID ? 0.4 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => { 
                                    if (user.id !== SUPER_ADMIN_ID) {
                                      e.currentTarget.style.color = '#0284c7'; 
                                      e.currentTarget.style.backgroundColor = '#f0f9ff';
                                      e.currentTarget.style.borderColor = '#bae6fd';
                                    }
                                  }}
                                  onMouseLeave={(e) => { 
                                    e.currentTarget.style.color = '#64748b'; 
                                    e.currentTarget.style.backgroundColor = '#ffffff';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                  }}
                                  title="Change User Role"
                                >
                                  <Shield size={16} />
                                </button>

                                {/* Suspend Button */}
                                <button
                                  onClick={() => handleStatusToggle(user.id, user.is_suspended)}
                                  disabled={user.id === SUPER_ADMIN_ID}
                                  style={{
                                    padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: user.id === SUPER_ADMIN_ID ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#ffffff', color: '#64748b', transition: 'all 0.2s', opacity: user.id === SUPER_ADMIN_ID ? 0.4 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => { 
                                    if (user.id !== SUPER_ADMIN_ID) {
                                      e.currentTarget.style.color = '#d97706'; 
                                      e.currentTarget.style.backgroundColor = '#fffbeb';
                                      e.currentTarget.style.borderColor = '#fde68a';
                                    }
                                  }}
                                  onMouseLeave={(e) => { 
                                    e.currentTarget.style.color = '#64748b'; 
                                    e.currentTarget.style.backgroundColor = '#ffffff';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                  }}
                                  title={Boolean(user.is_suspended) ? "Unsuspend User" : "Suspend User"}
                                >
                                  <AlertCircle size={16} />
                                </button>

                                {/* Delete Button */}
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={user.id === SUPER_ADMIN_ID}
                                  style={{
                                    padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: user.id === SUPER_ADMIN_ID ? 'not-allowed' : 'pointer',
                                    backgroundColor: '#ffffff', color: '#64748b', transition: 'all 0.2s', opacity: user.id === SUPER_ADMIN_ID ? 0.4 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}
                                  onMouseEnter={(e) => { 
                                    if (user.id !== SUPER_ADMIN_ID) {
                                      e.currentTarget.style.color = '#dc2626'; 
                                      e.currentTarget.style.backgroundColor = '#fef2f2';
                                      e.currentTarget.style.borderColor = '#fecaca';
                                    }
                                  }}
                                  onMouseLeave={(e) => { 
                                    e.currentTarget.style.color = '#64748b'; 
                                    e.currentTarget.style.backgroundColor = '#ffffff';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                  }}
                                  title="Delete User"
                                >
                                  <Trash2 size={16} />
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
           {/* TAB: BROADCAST */}
{activeTab === 'broadcast' && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {/* Form Section */}
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-5 flex items-center gap-3">
        <Radio size={22} className="text-rose-500 animate-pulse" />
        Create Broadcast
      </h2>
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
        <form onSubmit={handlePostAnnouncement} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
              Message Title
            </label>
            <input
              type="text"
              placeholder="E.g. System Maintenance"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
              Announcement Details
            </label>
            <textarea
              rows="5"
              placeholder="What do users need to know?"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none resize-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center gap-3 bg-amber-50/60 border border-amber-200/60 p-3.5 rounded-xl">
            <input
              type="checkbox"
              id="urgent-toggle"
              className="w-4 h-4 cursor-pointer accent-rose-600 rounded"
              checked={announcementForm.type === 'urgent'}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.checked ? 'urgent' : 'info' })}
            />
            <label htmlFor="urgent-toggle" className="text-xs font-semibold text-amber-900 cursor-pointer select-none">
              Mark as <span className="text-rose-600 font-bold">URGENT</span> announcement
            </label>
          </div>

          <button
            type="submit"
            disabled={isPosting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl border-none cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-200"
          >
            {isPosting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {editingAnnouncement ? 'Update Broadcast' : 'Post Broadcast'}
          </button>

          {editingAnnouncement && (
            <button
              type="button"
              onClick={() => {
                setEditingAnnouncement(null);
                setAnnouncementForm({ title: '', content: '', type: 'info' });
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 px-4 rounded-xl border border-slate-200 cursor-pointer transition-all"
            >
              Cancel Editing
            </button>
          )}
        </form>
      </div>
    </section>

    {/* List Section */}
    <section>
      <h2 className="text-xl font-bold text-slate-900 mb-5">
        Recent Broadcasts
      </h2>
      <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
        {announcements.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl py-12 px-6 text-center text-slate-400">
            No active announcements.
          </div>
        ) : (
          announcements.map((item) => {
            const typeColor = getTypeColor(item.type);
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-slate-900 text-sm">
                        {item.title}
                      </h3>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: typeColor.bg,
                          color: typeColor.text,
                          border: `1px solid ${typeColor.border}`,
                        }}
                      >
                        {getTypeIcon(item.type)}
                        {item.type || 'info'}
                      </span>
                    </div>
                    <p
                      className={`text-xs text-slate-600 leading-relaxed whitespace-pre-wrap transition-all ${
                        expandedId === item.id ? 'max-h-[500px] overflow-visible' : 'max-h-[60px] overflow-hidden truncate'
                      }`}
                    >
                      {item.content}
                    </p>
                    {item.content && item.content.length > 100 && (
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-transparent border-none cursor-pointer"
                      >
                        {expandedId === item.id ? 'Show Less' : 'Read More'}
                      </button>
                    )}
                    <div className="mt-3 text-[10px] text-slate-400 font-medium">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingAnnouncement(item);
                        setAnnouncementForm({ title: item.title, content: item.content, type: item.type || 'info' });
                      }}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(item.id)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={15} />
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
