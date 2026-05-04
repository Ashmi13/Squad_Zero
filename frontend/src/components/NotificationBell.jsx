import React, { useState, useEffect, useMemo } from 'react';
import { 
    Bell, X, Inbox, Pin, CheckCircle2, Maximize2,
    Info, AlertTriangle, AlertCircle, Edit2
} from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

export default function NotificationBell({ size = 20, color = 'currentColor' }) {
    const { theme } = useTheme();
    const { user, isLoading: authLoading } = useAuth();
    const isAdmin = user?.role === 'admin';
    
    const [notifications, setNotifications] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [readIds, setReadIds] = useState([]);
    const [pinnedIds, setPinnedIds] = useState([]);
    const [pulseBadge, setPulseBadge] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [filterTab, setFilterTab] = useState('inbox');
    const [selectedId, setSelectedId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', content: '', type: 'info' });

    const markAsRead = async (id) => {
        if (!id || readIds.includes(id)) return;
        // Optimistic client update so badge decrements immediately.
        setReadIds(prev => [...prev, id]);
        try {
            await axiosInstance.post(`/api/v1/announcements/${id}/read`);
        } catch (err) {
            console.error('Failed to mark read on server:', err);
        }
    };

    // Fetch announcements
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const response = await axiosInstance.get('/api/v1/announcements/with-status');
                const announcementData = response.data?.announcements || [];
                const userReadIds = response.data?.status?.read_announcement_ids || [];

                setNotifications(announcementData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
                setReadIds(userReadIds.map(id => Number(id)));
            } catch (error) {
                console.error('Error fetching announcements:', error);
            } finally {
                setLoading(false);
            }
        };
        if (!authLoading) {
            fetchNotifications();
        }
    }, [authLoading]);

    // Realtime subscription
    useEffect(() => {
        if (!supabase) return;
        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setNotifications(prev => [payload.new, ...prev]);
                    // Pulse badge to indicate new message
                    setPulseBadge(true);
                    window.setTimeout(() => setPulseBadge(false), 900);
                } else if (payload.eventType === 'UPDATE') {
                    setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
                } else if (payload.eventType === 'DELETE') {
                    setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                    setReadIds(prev => prev.filter(id => id !== Number(payload.old.id)));
                }
            })
            .subscribe();
        return () => channel.unsubscribe();
    }, []);

    const getIcon = (type, size = 16) => {
        const iconProps = { size, strokeWidth: 2 };
        switch (type) {
            case 'urgent': return <AlertCircle {...iconProps} color={theme.colors.error} />;
            case 'warning': return <AlertTriangle {...iconProps} color={theme.colors.warning} />;
            default: return <Info {...iconProps} color={theme.colors.primary} />;
        }
    };

    const filteredNotes = useMemo(() => {
        if (filterTab === 'important') return notifications.filter(n => n.type === 'urgent' || n.type === 'warning');
        if (filterTab === 'pinned') return notifications.filter(n => pinnedIds.includes(n.id));
        return notifications;
    }, [notifications, filterTab, pinnedIds]);

    const selectedNote = filteredNotes.find(n => n.id === selectedId);

    const togglePin = (id, e) => {
        e?.stopPropagation?.();
        setPinnedIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
    };

    const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Bell Button */}
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                    backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', position: 'relative',
                    transition: 'all 0.15s'
                }}
            >
                <Bell size={size} color={color} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -6, right: -6, minWidth: '18px', height: '18px',
                        padding: '0 5px', backgroundColor: '#ef4444', borderRadius: '999px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '700', color: 'white',
                        border: `2px solid #1e293b`,
                        transform: pulseBadge ? 'scale(1.12)' : 'scale(1)',
                        boxShadow: pulseBadge ? '0 0 0 8px rgba(239,68,68,0.09)' : 'none',
                        transition: 'transform 200ms ease, box-shadow 300ms ease'
                    }}>
                        {Math.min(unreadCount, 99)}
                    </span>
                )}
            </button>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', backgroundColor: '#000000dd'
                }}>
                    <div style={{
                        width: '100%', maxWidth: '1200px', height: '80vh',
                        display: 'flex', borderRadius: '12px', border: `1px solid #475569`,
                        overflow: 'hidden', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
                    }}>
                        
                        {/* COLUMN 1: NAVIGATION (20%) */}
                        <div style={{
                            width: '20%', backgroundColor: '#1e293b', borderRight: `1px solid #475569`,
                            display: 'flex', flexDirection: 'column', overflowY: 'auto'
                        }}>
                            <div style={{ padding: '20px', borderBottom: `1px solid #475569` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <Bell size={18} color={theme.colors.primary} />
                                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>Announcements</h3>
                                </div>
                                <p style={{ fontSize: '12px', color: '#94a3b8' }}>{notifications.length} messages</p>
                            </div>
                            
                            <nav style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {[
                                    { id: 'inbox', label: 'Inbox', icon: <Inbox size={16} />, count: notifications.length },
                                    { id: 'important', label: 'Important', icon: <AlertCircle size={16} />, count: notifications.filter(n => n.type === 'urgent' || n.type === 'warning').length },
                                    { id: 'pinned', label: 'Pinned', icon: <Pin size={16} />, count: pinnedIds.length }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setFilterTab(tab.id); setSelectedId(null); }}
                                        style={{
                                            padding: '12px 16px', borderRadius: '8px', border: 'none',
                                            backgroundColor: filterTab === tab.id ? theme.colors.primary : 'transparent',
                                            color: filterTab === tab.id ? '#ffffff' : '#cbd5e1',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                                            justifyContent: 'space-between', fontWeight: '600', fontSize: '13px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (filterTab !== tab.id) e.target.style.backgroundColor = '#334155';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (filterTab !== tab.id) e.target.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {tab.icon}
                                            {tab.label}
                                        </div>
                                        {tab.count > 0 && (
                                            <span style={{
                                                backgroundColor: filterTab === tab.id ? 'rgba(255,255,255,0.3)' : '#475569',
                                                color: '#f1f5f9', fontSize: '11px', fontWeight: '700',
                                                padding: '2px 8px', borderRadius: '999px'
                                            }}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </nav>

                            <div style={{ padding: '16px', borderTop: `1px solid #475569`, marginTop: 'auto' }}>
                                <button
                                    onClick={async () => {
                                        const allIds = notifications.map(n => n.id);
                                        setReadIds(allIds);
                                        try {
                                            await axiosInstance.post('/api/v1/announcements/read-all');
                                        } catch (err) {
                                            console.error('Failed to mark all read:', err);
                                        }
                                    }}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '6px',
                                        backgroundColor: '#334155', border: `1px solid #475569`,
                                        color: '#cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                                        transition: 'all 0.2s'
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
                                    <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                                    Mark All Read
                                </button>
                            </div>
                        </div>

                        {/* COLUMN 2: MESSAGE LIST (35%) */}
                        <div style={{
                            width: '35%', backgroundColor: '#0f172a', borderRight: `1px solid #475569`,
                            display: 'flex', flexDirection: 'column', overflowY: 'auto'
                        }}>
                            <div style={{ padding: '16px', borderBottom: `1px solid #475569` }}>
                                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Messages</h4>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {loading ? (
                                    <div style={{ padding: '16px' }}>
                                        {[1, 2, 3].map(i => (
                                            <div key={i} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '6px', opacity: 0.5 }}>
                                                <div style={{ height: '12px', backgroundColor: '#334155', borderRadius: '4px', marginBottom: '8px' }} />
                                                <div style={{ height: '10px', backgroundColor: '#334155', borderRadius: '4px', width: '80%' }} />
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredNotes.length > 0 ? (
                                    filteredNotes.map(note => {
                                        const isUnread = !readIds.includes(note.id);
                                        const isSelected = selectedId === note.id;
                                        const isHovered = hoveredId === note.id;
                                        const bg = isSelected ? '#334155' : isHovered ? '#3b4252' : isUnread ? '#334155' : '#1e293b';
                                        return (
                                            <div
                                                key={note.id}
                                                onClick={() => { setSelectedId(note.id); markAsRead(note.id); }}
                                                onMouseEnter={() => setHoveredId(note.id)}
                                                onMouseLeave={() => setHoveredId(null)}
                                                style={{
                                                    padding: '14px 12px', borderBottom: `1px solid #475569`,
                                                    backgroundColor: bg,
                                                    cursor: 'pointer', transition: 'background-color 120ms ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                    <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon(note.type, 14)}</div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '4px', marginBottom: '4px' }}>
                                                            <h4 style={{
                                                                fontSize: '12px', fontWeight: '700', color: '#f1f5f9',
                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                            }}>
                                                                {note.title}
                                                            </h4>
                                                            {!readIds.includes(note.id) && (
                                                                <div style={{
                                                                    width: '6px', height: '6px', borderRadius: '50%',
                                                                    backgroundColor: '#60a5fa', flexShrink: 0
                                                                }} />
                                                            )}
                                                        </div>
                                                        <p style={{
                                                            fontSize: '11px', color: '#94a3b8',
                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                        }}>
                                                            {note.content}
                                                        </p>
                                                        {note.type && (
                                                            <span style={{
                                                                display: 'inline-block', marginTop: '6px',
                                                                fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
                                                                backgroundColor: note.type === 'urgent' ? '#7f1d1d' : 'transparent',
                                                                color: note.type === 'urgent' ? '#fca5a5' : '#93c5fd',
                                                                padding: '2px 6px', borderRadius: '3px'
                                                            }}>
                                                                {note.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{
                                        height: '100%', display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center', color: '#475569', gap: '12px'
                                    }}>
                                        <Inbox size={32} />
                                        <p style={{ fontSize: '12px', textAlign: 'center' }}>No messages</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 3: DETAIL VIEW (45%) */}
                        <div style={{
                            width: '45%', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column',
                            borderLeft: `1px solid #475569`, position: 'relative'
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '16px 20px', borderBottom: `1px solid #475569`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', textTransform: 'uppercase' }}>
                                    {selectedNote ? 'Message Details' : 'Select a Message'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                                        color: '#94a3b8', padding: '4px', transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.color = '#f1f5f9'}
                                    onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            {selectedNote ? (
                                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                                    {/* Metadata */}
                                    <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid #475569` }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{
                                                fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                                backgroundColor: selectedNote.type === 'urgent' ? '#7f1d1d' : selectedNote.type === 'warning' ? '#92400e' : '#1e40af',
                                                color: selectedNote.type === 'urgent' ? '#fca5a5' : selectedNote.type === 'warning' ? '#fcd34d' : '#93c5fd',
                                                padding: '4px 8px', borderRadius: '4px'
                                            }}>
                                                {selectedNote.type || 'INFO'}
                                            </span>
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                {new Date(selectedNote.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title & Content */}
                                    {isEditing ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <input 
                                                type="text"
                                                style={{
                                                    width: '100%', padding: '10px 12px', backgroundColor: '#1e293b',
                                                    border: `1px solid #475569`, borderRadius: '6px',
                                                    color: '#f1f5f9', fontSize: '14px', fontWeight: '600', outline: 'none'
                                                }}
                                                value={editForm.title}
                                                onChange={(e) => setEditForm(p => ({...p, title: e.target.value}))}
                                            />
                                            <textarea 
                                                style={{
                                                    width: '100%', flex: 1, padding: '10px 12px', backgroundColor: '#1e293b',
                                                    border: `1px solid #475569`, borderRadius: '6px',
                                                    color: '#f1f5f9', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'none'
                                                }}
                                                value={editForm.content}
                                                onChange={(e) => setEditForm(p => ({...p, content: e.target.value}))}
                                            />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                            const res = await axiosInstance.patch(`/api/v1/admin/announcements/${selectedNote.id}`, editForm);
                                                            setNotifications(prev => prev.map(n => n.id === res.data.id ? res.data : n));
                                                            setIsEditing(false);
                                                        } catch (error) {
                                                            console.error("Error updating:", error);
                                                            alert("Failed to update.");
                                                        }
                                                    }}
                                                    style={{
                                                        flex: 1, padding: '8px', backgroundColor: theme.colors.primary,
                                                        color: '#ffffff', fontWeight: '600', borderRadius: '6px',
                                                        border: 'none', cursor: 'pointer', fontSize: '12px', transition: 'opacity 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.opacity = '0.85'}
                                                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                                                >
                                                    Save
                                                </button>
                                                <button 
                                                    onClick={() => setIsEditing(false)}
                                                    style={{
                                                        flex: 1, padding: '8px', backgroundColor: '#334155',
                                                        color: '#cbd5e1', fontWeight: '600', borderRadius: '6px',
                                                        border: 'none', cursor: 'pointer', fontSize: '12px'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1 }}>
                                            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#f1f5f9', marginBottom: '12px' }}>
                                                {selectedNote.title}
                                            </h2>
                                            <p style={{
                                                fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6,
                                                whiteSpace: 'pre-wrap', marginBottom: '16px'
                                            }}>
                                                {selectedNote.content}
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: `1px solid #475569`, marginTop: 'auto' }}>
                                        {isAdmin && !isEditing && (
                                            <button 
                                                onClick={() => {
                                                    setEditForm({ title: selectedNote.title, content: selectedNote.content, type: selectedNote.type || 'info' });
                                                    setIsEditing(true);
                                                }}
                                                style={{
                                                    flex: 1, padding: '8px', backgroundColor: '#334155',
                                                    color: '#cbd5e1', fontWeight: '600', borderRadius: '6px',
                                                    border: 'none', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s'
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
                                                <Edit2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                Edit
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => togglePin(selectedNote.id, e)}
                                            style={{
                                                flex: 1, padding: '8px', backgroundColor: pinnedIds.includes(selectedNote.id) ? '#92400e' : '#334155',
                                                color: pinnedIds.includes(selectedNote.id) ? '#fcd34d' : '#cbd5e1',
                                                fontWeight: '600', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                fontSize: '12px', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.target.style.backgroundColor = pinnedIds.includes(selectedNote.id) ? '#b45309' : '#475569';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.backgroundColor = pinnedIds.includes(selectedNote.id) ? '#92400e' : '#334155';
                                            }}
                                        >
                                            <Pin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                            {pinnedIds.includes(selectedNote.id) ? 'Pinned' : 'Pin'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', color: '#475569', gap: '12px'
                                }}>
                                    <Bell size={40} />
                                    <p style={{ fontSize: '13px', textAlign: 'center' }}>Select a message to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Dropdown */}
            {showDropdown && (
                <div style={{
                    position: 'absolute', right: 0, marginTop: '12px', width: '320px',
                    backgroundColor: '#1e293b',
                    border: `1px solid #475569`,
                    borderRadius: '12px',
                    zIndex: 50, overflow: 'hidden'
                }}>
                        <div style={{
                            padding: '16px', borderBottom: `1px solid #475569`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            backgroundColor: '#1e293b'
                        }}>
                        <h3 style={{ fontWeight: 'bold', color: '#f1f5f9', fontSize: '14px' }}>Recent Updates</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    if (!selectedId && notifications.length > 0) {
                                        setSelectedId(notifications[0].id);
                                    }
                                    setShowDropdown(false);
                                    setShowModal(true);
                                }}
                                style={{
                                    padding: '6px', backgroundColor: 'transparent', border: '1px solid #475569',
                                    borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Open full notification view"
                            >
                                <Maximize2 size={14} />
                            </button>
                            <button 
                                onClick={() => setShowDropdown(false)}
                                style={{
                                    padding: '6px', backgroundColor: 'transparent',
                                    border: '1px solid #475569', borderRadius: '6px',
                                    color: '#cbd5e1', cursor: 'pointer'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    <div style={{ maxHeight: '360px', overflowY: 'auto', backgroundColor: '#1e293b' }}>
                        {notifications.length > 0 ? (
                            <div>
                                {notifications.slice(0, 5).map((note) => (
                                        <div 
                                            key={note.id} 
                                            onClick={async () => { setShowModal(true); setShowDropdown(false); setSelectedId(note.id); await markAsRead(note.id); }}
                                            style={{
                                                padding: '14px 12px', borderBottom: `1px solid #475569`,
                                                cursor: 'pointer', transition: 'background-color 120ms ease',
                                                backgroundColor: !readIds.includes(note.id) ? '#334155' : '#1e293b',
                                                color: '#f1f5f9'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <div style={{ marginTop: '4px' }}>{getIcon(note.type, 16)}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {note.title}
                                                        </div>
                                                        {!readIds.includes(note.id) && (
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#60a5fa', flexShrink: 0 }} />
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {note.content.substring(0, 50)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.text.tertiary, fontSize: '12px' }}>
                                No announcements
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
