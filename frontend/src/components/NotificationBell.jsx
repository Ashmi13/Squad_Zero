import React, { useState, useEffect, useMemo } from 'react';
import { 
    Bell, X, Maximize2, Inbox, Pin, Star, CheckCircle2, Clock,
    Info, AlertTriangle, AlertCircle, Edit2, Check, ChevronRight, ActivitySquare, LayoutGrid
} from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

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

export default function NotificationBell({ size = 20, color = "#555" }) {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modalTab, setModalTab] = useState('inbox'); 
    const [selectedNote, setSelectedNote] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', content: '', type: 'info' });
    const [pinnedIds, setPinnedIds] = useState(() => {
        const saved = localStorage.getItem('pinned_announcements');
        return saved ? JSON.parse(saved) : [];
    });
    const [readIds, setReadIds] = useState(() => {
        const saved = localStorage.getItem('read_announcements');
        return saved ? JSON.parse(saved) : [];
    });

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get('/api/v1/announcements/');
            setNotifications(response.data);
            setUnreadCount(response.data.filter(n => !readIds.includes(n.id)).length);
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
                    setNotifications(prev => {
                        if (prev.some(n => n.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                    setUnreadCount(prev => prev + 1);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'announcements' },
                (payload) => {
                    setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
                    setSelectedNote(prev => prev?.id === payload.new.id ? payload.new : prev);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'announcements' },
                (payload) => {
                    setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                    setSelectedNote(prev => prev?.id === payload.old.id ? null : prev);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('pinned_announcements', JSON.stringify(pinnedIds));
    }, [pinnedIds]);

    useEffect(() => {
        localStorage.setItem('read_announcements', JSON.stringify(readIds));
        const unread = notifications.filter(n => !readIds.includes(n.id)).length;
        setUnreadCount(unread);
    }, [readIds, notifications]);

    const markAsRead = (id) => {
        if (!readIds.includes(id)) {
            const newReadIds = [...readIds, id];
            setReadIds(newReadIds);
            localStorage.setItem('read_announcements', JSON.stringify(newReadIds));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const togglePin = (id, e) => {
        e.stopPropagation();
        const newPinnedIds = pinnedIds.includes(id)
            ? pinnedIds.filter(pid => pid !== id)
            : [...pinnedIds, id];
        setPinnedIds(newPinnedIds);
        localStorage.setItem('pinned_announcements', JSON.stringify(newPinnedIds));
    };

    const filteredNotes = useMemo(() => {
        switch (modalTab) {
            case 'pinned': return notifications.filter(n => pinnedIds.includes(n.id));
            case 'important': return notifications.filter(n => n.type === 'urgent' || n.type === 'warning');
            default: return notifications;
        }
    }, [modalTab, notifications, pinnedIds]);

    const getIcon = (type, s = 20) => {
        switch (type) {
            case 'urgent': return <AlertCircle className="text-red-500" size={s} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={s} />;
            default: return <Info className="text-indigo-500" size={s} />;
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setIsEditing(false); // Reset edit state
    };

    return (
        <div className="relative">
            <div 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  position: 'relative', cursor: 'pointer',
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: '#f5f5f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >
                <Bell size={size} color={color} />
                {unreadCount > 0 && (
                    <div style={{
                        position: 'absolute', top: '1px', right: '1px',
                        minWidth: '16px', height: '16px', borderRadius: '999px',
                        backgroundColor: '#ef4444', color: 'white', fontSize: '10px',
                        fontWeight: 'bold', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', border: '2px solid #fff', padding: '0 4px'
                    }}>
                        {unreadCount}
                    </div>
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h3 className="font-bold text-white text-sm">Recent Updates</h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setShowModal(true); setShowDropdown(false); }}
                                className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-indigo-400 transition-colors"
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
                                        onClick={() => { markAsRead(note.id); setShowModal(true); setSelectedNote(note); setShowDropdown(false); }}
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
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 w-full max-w-6xl h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-300">
                        
                        {/* Sidebar */}
                        <aside className="w-full md:w-64 bg-zinc-900 border-r border-white/5 flex flex-col z-10 shrink-0">
                            <div className="p-8 border-b border-white/5 flex justify-between items-center md:block">
                                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl"><Bell className="text-indigo-400" size={20} /></div>
                                    Comms Center
                                </h2>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest hidden md:block">
                                    {notifications.length} Total Signals
                                </p>
                                <button onClick={handleCloseModal} className="md:hidden text-zinc-400 hover:text-white"><X size={20} /></button>
                            </div>
                            
                            <nav className="flex-1 p-4 space-y-2 border-b border-white/5 overflow-y-auto">
                                <TabButton active={modalTab === 'inbox'} onClick={() => setModalTab('inbox')} icon={<Inbox size={18} />} label="Inbox" count={notifications.length} />
                                <TabButton active={modalTab === 'important'} onClick={() => setModalTab('important')} icon={<Star size={18} />} label="Important" count={notifications.filter(n => n.type === 'urgent' || n.type === 'warning').length} />
                                <TabButton active={modalTab === 'pinned'} onClick={() => setModalTab('pinned')} icon={<Pin size={18} />} label="Pinned" count={pinnedIds.length} />
                            </nav>

                            <div className="p-4 mt-auto">
                                <button onClick={() => setReadIds(notifications.map(n => n.id))} className="w-full py-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2 group">
                                    <CheckCircle2 size={16} className="text-zinc-500 group-hover:text-green-400 transition-colors" /> Mark all as read
                                </button>
                            </div>
                        </aside>

                        {/* List Area */}
                        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/40 border-r border-white/5">
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
                                {loading ? (
                                    <div className="space-y-6">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="flex gap-4 animate-pulse p-4">
                                                <div className="w-10 h-10 bg-white/5 rounded-2xl shrink-0" />
                                                <div className="flex-1 space-y-3">
                                                    <div className="h-4 bg-white/5 rounded-lg w-1/3" />
                                                    <div className="h-3 bg-white/5 rounded-lg w-full" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : filteredNotes.length > 0 ? (
                                    filteredNotes.map(note => (
                                        <div 
                                            key={note.id}
                                            onClick={() => { setSelectedNote(note); markAsRead(note.id); setIsEditing(false); }}
                                            className={`group relative p-5 rounded-2xl transition-all cursor-pointer border ${
                                                selectedNote?.id === note.id 
                                                    ? 'bg-indigo-600/10 border-indigo-500/30' 
                                                    : 'bg-zinc-900/40 border-transparent hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            <div className="flex gap-4">
                                                <div className="mt-1">{getIcon(note.type)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-2 gap-4">
                                                        <div className="flex flex-col gap-1 min-w-0">
                                                            <h4 className={`text-sm md:text-base font-bold transition-colors truncate ${selectedNote?.id === note.id ? 'text-indigo-400' : 'text-zinc-200'}`}>
                                                                {note.title}
                                                            </h4>
                                                            <div className="flex shadow-sm items-center gap-2">
                                                                {note.type && (
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider
                                                                        ${note.type === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                                                          note.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                                                                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                                                                        {note.type}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <div className="hidden sm:flex text-[10px] text-zinc-500 items-center justify-center bg-zinc-950 px-2 py-1 rounded-md border border-white/5 font-medium">
                                                                {new Date(note.created_at).toLocaleDateString()}
                                                            </div>
                                                            <button 
                                                                onClick={(e) => togglePin(note.id, e)} 
                                                                className={`p-1.5 rounded-lg transition-all ${pinnedIds.includes(note.id) ? 'bg-amber-500/10' : 'hover:bg-white/10'}`}
                                                            >
                                                                <Pin size={14} className={pinnedIds.includes(note.id) ? "text-amber-500 fill-amber-500" : "text-zinc-500"} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-zinc-400 text-xs md:text-sm line-clamp-2 mt-2 leading-relaxed">{note.content}</p>
                                                </div>
                                            </div>
                                            {!readIds.includes(note.id) && (
                                                <div className="absolute left-0 top-1/2 -tranzinc-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4 opacity-60">
                                        <Inbox size={48} className="text-zinc-600" />
                                        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Inbox Zero</p>
                                    </div>
                                )}
                            </div>
                        </main>

                        {/* Detail View */}
                        <section className="hidden md:flex w-[400px] lg:w-[500px] bg-zinc-900 flex-col shrink-0 relative shadow-[-10px_0_30px_rgba(0,0,0,0.2)] z-20">
                            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-4">
                                     {selectedNote ? 'Signal Details' : 'Preview'}
                                </div>
                                <button onClick={handleCloseModal} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20">
                                    <X size={18} />
                                </button>
                            </div>

                            {selectedNote ? (
                                <div className="p-8 md:p-10 flex-1 overflow-y-auto animate-in slide-in-from-right-4 duration-300">
                                    <header className="mb-8 pb-8 border-b border-white/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                 <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                    ${selectedNote.type === 'urgent' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                                      selectedNote.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                                      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                                                    {selectedNote.type || 'info'}
                                                </span>
                                                <div className="text-[11px] font-bold text-zinc-500 flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    {new Date(selectedNote.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                            {isAdmin && !isEditing && (
                                                <button 
                                                    onClick={() => {
                                                        setEditForm({
                                                            title: selectedNote.title,
                                                            content: selectedNote.content,
                                                            type: selectedNote.type || 'info'
                                                        });
                                                        setIsEditing(true);
                                                    }}
                                                    className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                                                    title="Edit Announcement"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        {isEditing ? (
                                            <input 
                                                type="text" 
                                                className="w-full mt-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white focus:outline-none focus:border-indigo-500"
                                                value={editForm.title}
                                                onChange={(e) => setEditForm(p => ({...p, title: e.target.value}))}
                                            />
                                        ) : (
                                            <h3 className="text-2xl font-black text-white leading-tight">
                                                {selectedNote.title}
                                            </h3>
                                        )}
                                    </header>
                                    
                                    <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed text-sm whitespace-pre-wrap">
                                        {isEditing ? (
                                            <textarea 
                                                className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 resize-none"
                                                value={editForm.content}
                                                onChange={(e) => setEditForm(p => ({...p, content: e.target.value}))}
                                            />
                                        ) : (
                                            <p className="whitespace-pre-wrap">{selectedNote.content}</p>
                                        )}
                                    </div>

                                    {isEditing && (
                                        <div className="mt-8 flex gap-3">
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        const res = await axiosInstance.patch(`/api/v1/admin/announcements/${selectedNote.id}`, editForm);
                                                        setSelectedNote(res.data);
                                                        setNotifications(prev => prev.map(n => n.id === res.data.id ? res.data : n));
                                                        setIsEditing(false);
                                                    } catch (error) {
                                                        console.error("Error updating feature:", error);
                                                        alert("Failed to update announcement.");
                                                    }
                                                }}
                                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Check size={16} /> Save Changes
                                            </button>
                                            <button 
                                                onClick={() => setIsEditing(false)}
                                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold rounded-xl transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}

                                    <div className="mt-12 pt-8 border-t border-white/5">
                                        <button 
                                            onClick={(e) => togglePin(selectedNote.id, e)}
                                            className={`flex items-center justify-center w-full gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all group ${
                                                pinnedIds.includes(selectedNote.id) 
                                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20' 
                                                    : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white border border-white/5 hover:border-white/10'
                                            }`}
                                        >
                                            <Pin size={18} className={pinnedIds.includes(selectedNote.id) ? "fill-amber-500 group-hover:scale-110 transition-transform" : "group-hover:scale-110 transition-transform"} />
                                            {pinnedIds.includes(selectedNote.id) ? 'Keep Pinned to Top' : 'Pin for Later'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                                    <div className="w-20 h-20 rounded-full bg-zinc-950 border border-white/5 flex items-center justify-center mb-6 shadow-inner">
                                        <Bell size={28} className="text-zinc-600" />
                                    </div>
                                    <h4 className="text-lg font-bold text-zinc-300 mb-2">No Signal Selected</h4>
                                    <p className="text-sm text-zinc-500 max-w-[200px] leading-relaxed">Select an item from the list to view its full contents here.</p>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}
