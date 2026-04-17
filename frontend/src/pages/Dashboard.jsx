import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Mail, Lock } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user info from localStorage
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/');
    } else {
      setUser(JSON.parse(userData));
      setLoading(false);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">SquadZero</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.full_name || user?.email}! 👋
          </h2>
          <p className="text-gray-600 text-lg">
            You&apos;re successfully logged in to SquadZero Authentication System
          </p>
        </div>

        {/* User Profile Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* User Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="text-blue-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">User Profile</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="text-gray-900 font-medium">{user?.full_name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900 font-medium">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Lock className="text-green-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Account Status</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Session</span>
                <span className="text-sm text-gray-900 font-medium">Secure</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Mail className="text-purple-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Features</h3>
            </div>
            <ul className="space-y-2">
              <li className="text-sm text-gray-600">✓ Email Authentication</li>
              <li className="text-sm text-gray-600">✓ JWT Tokens</li>
              <li className="text-sm text-gray-600">✓ Secure Sessions</li>
            </ul>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white rounded-lg shadow p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Available Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-l-4 border-blue-600 pl-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Email Login</h4>
              <p className="text-gray-600">
                Secure email-based authentication with password protection
              </p>
            </div>
            <div className="border-l-4 border-green-600 pl-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Account Creation</h4>
              <p className="text-gray-600">Easy registration with email verification</p>
            </div>
            <div className="border-l-4 border-purple-600 pl-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">JWT Tokens</h4>
              <p className="text-gray-600">Secure token-based authentication system</p>
            </div>
            <div className="border-l-4 border-orange-600 pl-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Session Management</h4>
              <p className="text-gray-600">Secure session handling with automatic logout</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
          <p>&copy; 2026 SquadZero Authentication System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
