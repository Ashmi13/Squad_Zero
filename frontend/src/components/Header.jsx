import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Bell, 
    Settings, 
    X, 
    Info, 
    AlertTriangle, 
    AlertCircle, 
    Maximize2, 
    Inbox, 
    Pin, 
    Star, 
    ChevronRight,
    Clock,
    CheckCircle2
} from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import { supabase } from '../lib/supabase';
import styles from './Header.module.css';

const Header = ({ title = "Dashboard", subtitle = "Manage your study materials and documents" }) => {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalTab, setModalTab] = useState('inbox'); // inbox, pinned, important
    const [selectedNote, setSelectedNote] = useState(null);
    const [pinnedIds, setPinnedIds] = useState(() => {
        const saved = localStorage.getItem('pinned_announcements');
        return saved ? JSON.parse(saved) : [];
    });
    const [readIds, setReadIds] = useState([]);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/api/v1/announcements/with-status');
            const announcementData = response.data?.announcements || [];
            const userReadIds = response.data?.status?.read_announcement_ids || [];

            setNotifications(announcementData);
            setReadIds(userReadIds.map(id => Number(id)));
        } catch (error) {
            console.error('Failed to fetch announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();

        const channel = supabase
            .channel('public:announcements')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'announcements' },
                (payload) => {
                    // Check if already in list to avoid duplicates on refresh/concurrent events
                    setNotifications(prev => {
                        if (prev.some(n => n.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'announcements' },
                (payload) => {
                    setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
                    // Update selected note if it's the one being edited
                    setSelectedNote(prev => prev?.id === payload.new.id ? payload.new : prev);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'announcements' },
                (payload) => {
                    setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                        setReadIds(prev => prev.filter(id => id !== Number(payload.old.id)));
                    // Deselect if active
                    setSelectedNote(prev => prev?.id === payload.old.id ? null : prev);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Sync persistence to localStorage
    useEffect(() => {
        localStorage.setItem('pinned_announcements', JSON.stringify(pinnedIds));
    }, [pinnedIds]);

    const togglePin = (e, id) => {
        e.stopPropagation();
        setPinnedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const markAsRead = async (id) => {
        if (readIds.includes(id)) return;
        setReadIds(prev => [...prev, id]);
        try {
            await axiosInstance.post(`/api/v1/announcements/${id}/read`);
        } catch (error) {
            console.error('Failed to persist read status:', error);
        }
    };

    const markAllAsRead = async () => {
        const allIds = notifications.map(n => n.id);
        setReadIds(allIds);
        try {
            await axiosInstance.post('/api/v1/announcements/read-all');
        } catch (error) {
            console.error('Failed to persist read-all status:', error);
        }
    };

    const unreadCount = useMemo(
        () => notifications.filter(n => !readIds.includes(Number(n.id))).length,
        [notifications, readIds]
    );

    const filteredNotes = useMemo(() => {
        switch (modalTab) {
            case 'pinned': return notifications.filter(n => pinnedIds.includes(n.id));
            case 'important': return notifications.filter(n => n.type === 'urgent' || n.type === 'warning');
            default: return notifications;
        }
    }, [modalTab, notifications, pinnedIds]);

    const getIcon = (type, size = 20) => {
        switch (type) {
            case 'urgent': return <AlertCircle className="text-red-500" size={size} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={size} />;
            default: return <Info className="text-indigo-500" size={size} />;
        }
    };

    return (
        <div className={styles.header}>
            <div className={styles.titleSection}>
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>

            <div className={styles.actions}>
                <div className={styles.searchContainer}>
                    <Search size={18} className={styles.searchIcon} />
                    <input type="text" placeholder="Search files..." className={styles.searchInput} />
                </div>

                {/* NOTIFICATION SYSTEM */}
                <div className="relative">
                    <button 
                        className={styles.iconButton}
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && <div className={styles.notificationDot}>{unreadCount}</div>}
                    </button>

                    {/* Step 1: Dropdown */}
                    {showDropdown && (
                        <div className="absolute right-0 mt-3 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <h3 className="font-bold text-white text-sm">Recent Updates</h3>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setShowModal(true); setShowDropdown(false); }}
                                        className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors"
                                        title="Expand to Notification Center"
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                    <button onClick={() => setShowDropdown(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="p-8 space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="flex gap-3 animate-pulse">
                                                <div className="w-8 h-8 bg-white/5 rounded-full shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-3 bg-white/5 rounded w-3/4" />
                                                    <div className="h-2 bg-white/5 rounded w-1/2" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (notifications && notifications.length > 0) ? (
                                    <div className="divide-y divide-white/5">
                                        {notifications.map((note) => (
                                            <div 
                                                key={note.id} 
                                                onClick={async () => { await markAsRead(note.id); setShowModal(true); setSelectedNote(note); setShowDropdown(false); }}
                                                className={`p-4 hover:bg-white/[0.04] transition-all cursor-pointer relative group ${!(readIds || []).includes(note.id) ? 'bg-indigo-500/[0.03]' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="mt-1 transition-transform group-hover:scale-110 duration-200">{getIcon(note.type, 18)}</div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <div className="text-xs font-bold text-white pr-2 group-hover:text-indigo-400 transition-colors uppercase tracking-wider">{note.title}</div>
                                                            <div className="flex items-center gap-2">
                                                                {(pinnedIds || []).includes(note.id) && <Pin size={10} className="text-amber-400 fill-amber-400" />}
                                                                {!(readIds || []).includes(note.id) && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                                            </div>
                                                        </div>
                                                        <div className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed italic">
                                                            {note.content}
                                                        </div>
                                                        <div className="text-[9px] text-zinc-500 mt-2 flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {new Date(note.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center text-zinc-500 text-xs italic">
                                        No announcements found
                                    </div>
                                )}
                                {(notifications && notifications.length > 0) && (
                                    <button 
                                        onClick={() => { setShowModal(true); setShowDropdown(false); }}
                                        className="w-full py-3 text-[11px] font-bold text-indigo-400 hover:bg-indigo-500/5 transition-colors border-t border-white/5"
                                    >
                                        VIEW ALL ANNOUNCEMENTS
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Main Notification Center Modal */}
                    {showModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="bg-zinc-900 w-full max-w-5xl h-[80vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
                                
                                {/* Left Sidebar */}
                                <aside className="w-full md:w-72 bg-zinc-900 border-r border-white/5 flex flex-col">
                                    <div className="p-8 border-b border-white/5">
                                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                            <Bell className="text-indigo-500" size={20} />
                                            Center
                                        </h2>
                                    </div>
                                    
                                    <nav className="flex-1 p-4 space-y-2">
                                        <TabButton 
                                            active={modalTab === 'inbox'} 
                                            onClick={() => setModalTab('inbox')} 
                                            icon={<Inbox size={18} />} 
                                            label="Inbox" 
                                            count={notifications.length}
                                        />
                                        <TabButton 
                                            active={modalTab === 'important'} 
                                            onClick={() => setModalTab('important')} 
                                            icon={<Star size={18} />} 
                                            label="Important" 
                                            count={notifications.filter(n => n.type === 'urgent' || n.type === 'warning').length}
                                        />
                                        <TabButton 
                                            active={modalTab === 'pinned'} 
                                            onClick={() => setModalTab('pinned')} 
                                            icon={<Pin size={18} />} 
                                            label="Pinned" 
                                            count={pinnedIds.length}
                                        />
                                    </nav>

                                    <div className="p-4 mt-auto">
                                        <button 
                                            onClick={markAllAsRead}
                                            className="w-full py-3 rounded-xl border border-white/5 text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 size={14} />
                                            Mark all as read
                                        </button>
                                    </div>
                                </aside>

                                {/* List Section */}
                                <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/30">
                                    <div className="flex-1 overflow-y-auto p-2">
                                        {loading ? (
                                            <div className="p-6 space-y-6">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <div key={i} className="flex gap-4 animate-pulse p-4">
                                                        <div className="w-10 h-10 bg-white/5 rounded-2xl shrink-0" />
                                                        <div className="flex-1 space-y-3">
                                                            <div className="h-4 bg-white/5 rounded-lg w-1/3" />
                                                            <div className="h-3 bg-white/5 rounded-lg w-full" />
                                                            <div className="h-2 bg-white/5 rounded-lg w-1/4" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : filteredNotes.length > 0 ? (
                                            filteredNotes.map(note => (
                                                <div 
                                                    key={note.id}
                                                    onClick={async () => { setSelectedNote(note); await markAsRead(note.id); }}
                                                    className={`group relative p-5 rounded-3xl mb-2 transition-all cursor-pointer border ${
                                                        selectedNote?.id === note.id 
                                                            ? 'bg-indigo-600/10 border-indigo-500/30' 
                                                            : 'bg-transparent border-transparent hover:bg-white/[0.03]'
                                                    }`}
                                                >
                                                    <div className="flex gap-4">
                                                        <div className="mt-1">{getIcon(note.type)}</div>
                                                        <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <h4 className={`font-bold transition-colors truncate ${selectedNote?.id === note.id ? 'text-indigo-400' : 'text-white'}`}>
                                                                        {note.title}
                                                                    </h4>
                                                                    {note.type === 'urgent' && (
                                                                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-tighter border border-red-500/20">
                                                                            Important
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <button 
                                                                    onClick={(e) => togglePin(e, note.id)}
                                                                    className={`transition-colors ${pinnedIds.includes(note.id) ? 'text-amber-500' : 'text-zinc-600 group-hover:text-zinc-400'}`}
                                                                >
                                                                    <Pin size={14} fill={pinnedIds.includes(note.id) ? 'currentColor' : 'none'} />
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{note.content}</p>
                                                            <div className="flex items-center gap-2 mt-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                                                <Clock size={10} />
                                                                {new Date(note.created_at).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        {!readIds.includes(note.id) && (
                                                            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-r-full" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm italic opacity-50">
                                                <Inbox size={48} className="mb-4 text-zinc-700" />
                                                Nothing to show in {modalTab}
                                            </div>
                                        )}
                                    </div>
                                </main>

                                {/* Content Section */}
                                <section className="hidden lg:flex w-[400px] bg-zinc-900 border-l border-white/5 flex-col">
                                    {selectedNote ? (
                                        <div className="p-10 flex-1 overflow-y-auto animate-in slide-in-from-right-4 duration-300">
                                            <header className="mb-8">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase text-zinc-400 tracking-tighter">
                                                        {selectedNote.type || 'info'}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-zinc-500">
                                                        {new Date(selectedNote.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                                <h3 className="text-2xl font-black text-white leading-tight">
                                                    {selectedNote.title}
                                                </h3>
                                            </header>
                                            
                                            <div className="prose prose-invert max-w-none">
                                                <p className="text-zinc-300 leading-relaxed text-sm whitespace-pre-wrap">
                                                    {selectedNote.content}
                                                </p>
                                            </div>

                                            <div className="mt-12 pt-8 border-t border-white/5">
                                                <button 
                                                    onClick={() => togglePin({ stopPropagation: () => {} }, selectedNote.id)}
                                                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                                                        pinnedIds.includes(selectedNote.id) 
                                                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                                            : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-transparent'
                                                    }`}
                                                >
                                                    <Pin size={16} fill={pinnedIds.includes(selectedNote.id) ? 'currentColor' : 'none'} />
                                                    {pinnedIds.includes(selectedNote.id) ? 'Pinned to Top' : 'Pin for Later'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center p-10 text-center text-zinc-600">
                                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                                <ChevronRight size={24} />
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-widest">Select a message</p>
                                            <p className="text-xs mt-2 text-zinc-500">Click an announcement on the left to read full details.</p>
                                        </div>
                                    )}
                                    <div className="p-6 border-t border-white/5">
                                        <button 
                                            onClick={() => setShowModal(false)}
                                            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
                                        >
                                            Close Center
                                        </button>
                                    </div>
                                </section>

                                {/* Mobile Close */}
                                <button 
                                    onClick={() => setShowModal(false)}
                                    className="lg:hidden absolute top-6 right-6 p-4 bg-zinc-950 rounded-2xl text-white shadow-2xl"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button className={styles.iconButton}>
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
};

// Internal sub-components
const TabButton = ({ active, onClick, icon, label, count }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 font-bold text-sm ${
            active 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
        }`}
    >
        <div className="flex items-center gap-3">
            {icon}
            {label}
        </div>
        {count > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/5'}`}>
                {count}
            </span>
        )}
    </button>
);

export default Header;
