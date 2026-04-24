import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Activity, 
  Cpu, 
  Shield, 
  Search,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Plus,
  Radio,
  Send,
  Loader2,
  Lock,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { axiosInstance } from '@/lib/axios';

const SUPER_ADMIN_ID = "b422ac95-a9dd-4aa0-ab5c-54c09fa58267";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // Added activeTab state
  const [stats, setStats] = useState({
    total_users: 0,
    total_files: 0,
    active_sessions: 0,
    gemini_usage: 0
  });
  const [loading, setLoading] = useState(true);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Announcement Form State
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info' });
  const [isPosting, setIsPosting] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

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
      setAnnouncements(announcementsRes.data);
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

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await axiosInstance.delete(`/api/v1/admin/announcements/${id}`);
      setAnnouncements(announcements.filter(a => a.id !== id));
    } catch (err) {
      console.error('Delete Error:', err);
    }
  };

  const handleRoleUpdate = async (userId, currentRole) => {
    if (userId === SUPER_ADMIN_ID) return;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await axiosInstance.patch(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Role Update Error:', err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      {/* Secondary Sidebar (Admin Specific) */}
      <aside className="w-20 bg-[#1e293b]/50 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-8 gap-6 z-10 sticky top-0 h-screen">
        <NavIcon 
          active={activeTab === 'overview'} 
          onClick={() => setActiveTab('overview')} 
          icon={<LayoutDashboard className="w-6 h-6" />} 
          label="Overview" 
        />
        <NavIcon 
          active={activeTab === 'users'} 
          onClick={() => setActiveTab('users')} 
          icon={<Users className="w-6 h-6" />} 
          label="Users" 
        />
        <NavIcon 
          active={activeTab === 'broadcast'} 
          onClick={() => setActiveTab('broadcast')} 
          icon={<Radio className="w-6 h-6" />} 
          label="Broadcast" 
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-10 font-sans text-slate-200 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
              <header className="text-center space-y-4 pt-10">
                <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-sm font-semibold mb-2 border border-blue-500/20">
                  <Lock className="w-4 h-4" />
                  Secure Admin Access
                </div>
                <h1 className="text-5xl font-extrabold text-white tracking-tight">
                  Neura Note: <span className="text-blue-500">Command Center</span>
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                  System health monitoring and infrastructure overview.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <GlassCard icon={<Users className="text-blue-400" />} label="Total Users" value={stats.total_users} color="blue" />
                <GlassCard icon={<FileText className="text-purple-400" />} label="System Files" value={stats.total_files} color="purple" />
                <GlassCard icon={<Activity className="text-emerald-400" />} label="Active Sessions" value={stats.active_sessions} color="emerald" />
                <GlassCard icon={<Cpu className="text-amber-400" />} label="API Usage" value={`${stats.gemini_usage}%`} color="amber" />
              </div>
            </div>
          )}

          {/* TAB: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-[#1e293b]/40 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Users className="w-6 h-6 text-blue-500" />
                    User Database
                  </h2>
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      className="w-full bg-[#0f172a]/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-sm font-semibold border-b border-white/5">
                        <th className="px-6 py-4">User Details</th>
                        <th className="px-6 py-4">Role Status</th>
                        <th className="px-6 py-4 text-right">Settings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/10 overflow-hidden">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  user.full_name?.[0] || user.email[0].toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-white">{user.full_name || 'System User'}</div>
                                <div className="text-xs text-slate-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              disabled={user.id === SUPER_ADMIN_ID}
                              onClick={() => handleRoleUpdate(user.id, user.role)}
                              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                user.role === 'admin' 
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                              }`}
                            >
                              <Shield className="w-4 h-4" />
                              {user.role}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                              <button className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-blue-400 hover:border-blue-500/50 shadow-sm transition-all">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                disabled={user.id === SUPER_ADMIN_ID}
                                className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-red-400 hover:border-red-500/50 shadow-sm transition-all disabled:opacity-10"
                              >
                                <Trash2 className="w-4 h-4" />
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

          {/* TAB: BROADCAST CENTER */}
          {activeTab === 'broadcast' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Form */}
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Radio className="w-6 h-6 text-red-500" />
                  Broadcaster
                </h2>
                <div className="bg-[#1e293b]/40 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <form onSubmit={handlePostAnnouncement} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">Message Title</label>
                      <input 
                        type="text" 
                        placeholder="E.g. System Maintenance"
                        className="w-full bg-[#0f172a]/50 border border-white/5 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all text-white placeholder:text-slate-600"
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-400 mb-2">Announcement Details</label>
                      <textarea 
                        rows="4"
                        placeholder="What do users need to know?"
                        className="w-full bg-[#0f172a]/50 border border-white/5 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all resize-none text-white placeholder:text-slate-600"
                        value={announcementForm.content}
                        onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                        required
                      ></textarea>
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <input 
                        type="checkbox"
                        id="urgent-toggle"
                        className="w-5 h-5 rounded border-white/10 bg-[#0f172a] text-blue-500 focus:ring-blue-500/20"
                        checked={announcementForm.type === 'urgent'}
                        onChange={(e) => setAnnouncementForm({...announcementForm, type: e.target.checked ? 'urgent' : 'info'})}
                      />
                      <label htmlFor="urgent-toggle" className="text-sm font-bold text-slate-300 cursor-pointer flex items-center gap-2">
                        Mark as <span className="text-red-500 uppercase tracking-tighter">Important</span>
                      </label>
                    </div>

                    <button 
                      type="submit"
                      disabled={isPosting}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-blue-500/10 transition-all disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      {editingAnnouncement ? 'Update Announcement' : 'Post Broadcast'}
                    </button>
                    {editingAnnouncement && (
                      <button 
                        type="button"
                        onClick={() => {
                            setEditingAnnouncement(null);
                            setAnnouncementForm({ title: '', content: '' });
                        }}
                        className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-4 rounded-2xl transition-all"
                      >
                        Cancel Editing
                      </button>
                    )}
                  </form>
                </div>
              </section>

              {/* List */}
              <section className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Recent Broadcasts</h2>
                <div className="space-y-4">
                  {announcements.length === 0 ? (
                    <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl p-10 text-center text-slate-500">
                      No active announcements.
                    </div>
                  ) : (
                    announcements.map(item => (
                      <div key={item.id} className="bg-[#1e293b]/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all group">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-white text-lg mb-1">{item.title}</h3>
                            <p className="text-slate-400 text-sm line-clamp-2">{item.content}</p>
                            <div className="mt-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {new Date(item.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => {
                                setEditingAnnouncement(item);
                                setAnnouncementForm({ title: item.title, content: item.content });
                              }}
                              className="p-2 hover:bg-blue-500/10 rounded-xl text-blue-500 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAnnouncement(item.id)}
                              className="p-2 hover:bg-red-500/10 rounded-xl text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Sub-component for Sidebar Icons
const NavIcon = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`group relative p-3 rounded-2xl transition-all duration-300 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
        : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
    }`}
  >
    {icon}
    {/* Tooltip */}
    <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl border border-white/5">
      {label}
    </span>
    {/* Active indicator bar */}
    {active && (
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-l-full" />
    )}
  </button>
);

const GlassCard = ({ icon, label, value, color }) => {
  const colors = {
    blue: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20",
    purple: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
    emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
    amber: "from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20",
  };

  return (
    <div className={`bg-[#1e293b]/40 backdrop-blur-md border p-6 rounded-[2rem] shadow-2xl transition-all hover:scale-105 ${colors[color]}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-white/5 rounded-2xl shadow-sm">
          {React.cloneElement(icon, { className: 'w-6 h-6' })}
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</div>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
  );
};

export default AdminDashboard;



