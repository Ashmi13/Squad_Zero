import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Activity, 
  Cpu, 
  Shield, 
  ShieldAlert, 
  Search,
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
  X,
  AlertTriangle
} from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';

const SUPER_ADMIN_ID = "b422ac95-a9dd-4aa0-ab5c-54c09fa58267";

const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total_users: 0,
    total_files: 0,
    active_sessions: 0,
    gemini_usage: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({ email: '', fullName: '', password: '' });
  const [editData, setEditData] = useState({ fullName: '' });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        axiosInstance.get('/api/v1/admin/users'),
        axiosInstance.get('/api/v1/admin/stats')
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError('Failed to load dashboard data. Please ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/api/v1/admin/users', {
        email: formData.email,
        full_name: formData.fullName,
        password: formData.password
      });
      setShowCreateModal(false);
      setFormData({ email: '', fullName: '', password: '' });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.patch(`/api/v1/admin/users/${selectedUser.id}`, {
        full_name: editData.fullName
      });
      setShowEditModal(false);
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    try {
      await axiosInstance.delete(`/api/v1/admin/users/${selectedUser.id}`);
      setShowDeleteModal(false);
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleRoleUpdate = async (userId, newRole) => {
    if (userId === SUPER_ADMIN_ID) {
      alert("Security Rule: Cannot change role of Super Admin.");
      return;
    }

    try {
      await axiosInstance.patch(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white p-4 text-center">
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl max-w-md">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6 lg:p-10">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Command Center</h1>
          <p className="text-slate-400">System overview and user management</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <UserPlus className="w-5 h-5" />
          Create User
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          icon={<Users className="w-6 h-6 text-cyan-400" />} 
          title="Total Users" 
          value={stats.total_users} 
          subtitle="Registered members"
        />
        <StatCard 
          icon={<FileText className="w-6 h-6 text-purple-400" />} 
          title="Files Uploaded" 
          value={stats.total_files} 
          subtitle="Knowledge base growth"
        />
        <StatCard 
          icon={<Activity className="w-6 h-6 text-emerald-400" />} 
          title="Active Sessions" 
          value={stats.active_sessions} 
          subtitle="Real-time monitoring"
        />
        <StatCard 
          icon={<Cpu className="w-6 h-6 text-amber-400" />} 
          title="Gemini Usage" 
          value={`${stats.gemini_usage}%`} 
          subtitle="API quota consumption"
        />
      </div>

      {/* User Management Table */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">User Management</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              className="bg-slate-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 w-full md:w-80 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status & Role</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.04] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20 capitalize overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (user.full_name?.[0] || user.email[0])
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{user.full_name || 'No Name'}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tighter ${
                        user.role === 'admin' 
                          ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-2 h-2 mr-1" />}
                        {user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      {/* Role Toggle Button */}
                      {user.id !== SUPER_ADMIN_ID && (
                        <button 
                          onClick={() => handleRoleUpdate(user.id, user.role === 'admin' ? 'user' : 'admin')}
                          className={`p-2 rounded-lg transition-colors ${user.role === 'admin' ? 'hover:bg-amber-500/20 text-amber-500' : 'hover:bg-cyan-500/20 text-cyan-500'}`}
                          title={user.role === 'admin' ? "Demote to User" : "Promote to Admin"}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Edit Button */}
                      {(user.id !== SUPER_ADMIN_ID || currentUser?.id === SUPER_ADMIN_ID) && (
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setEditData({ fullName: user.full_name || '' });
                            setShowEditModal(true);
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Edit User"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete Button */}
                      {user.id !== SUPER_ADMIN_ID && user.id !== currentUser?.id && (
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="p-10 text-center text-slate-500">
            No users found matching your search.
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Create Modal */}
      {showCreateModal && (
        <Modal title="Create New User" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 outline-none"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 outline-none"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Initial Password</label>
              <input 
                type="password" 
                required
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 outline-none"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div className="pt-4">
              <button 
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
              >
                Create Account
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <Modal title="Edit User Profile" onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 outline-none"
                value={editData.fullName}
                onChange={(e) => setEditData({...editData, fullName: e.target.value})}
              />
            </div>
            <div className="pt-2 text-xs text-slate-500 italic">
              Editing: {selectedUser?.email}
            </div>
            <div className="pt-4">
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal title="Confirm Deletion" onClose={() => setShowDeleteModal(false)}>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Delete User Account?</h3>
              <p className="text-slate-400 text-sm mt-1">
                This will permanently remove <span className="text-white font-semibold">{selectedUser?.email}</span> from the system. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const StatCard = ({ icon, title, value, subtitle }) => (
  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl hover:border-white/20 transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
        {icon}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
    </div>
    <div className="text-2xl font-bold text-white mb-1 tracking-tight">{value}</div>
    <div className="text-sm font-medium text-slate-200 mb-1">{title}</div>
    <div className="text-xs text-slate-500">{subtitle}</div>
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm" onClick={onClose}></div>
    <div className="bg-[#1e293b] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white uppercase tracking-tight text-sm">{title}</h2>
        <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  </div>
);

export default AdminDashboard;
