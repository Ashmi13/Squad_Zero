import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setTokens } from '@/utils/tokenStorage';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const processed = React.useRef(false);

  useEffect(() => {
    if (processed.current) return;
    
    // Check both hash (#) and search (?) to be extra safe
    const hash = window.location.hash.replace('#', '');
    const search = window.location.search.replace('?', '');
    const params = new URLSearchParams(hash || search);

    const access = params.get('access');
    const refresh = params.get('refresh');
    const userJson = params.get('user');

    if (userJson) {
      processed.current = true;
      try {
        const user = JSON.parse(decodeURIComponent(userJson));
        
        // 1. Store token
        if (access) {
          setTokens(access, refresh);
        }
        
        // 2. Store user record for Dashboard.jsx persistence
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('OAuth Login Successful, redirecting to files...');
        navigate('/files', { replace: true });
      } catch (e) {
        console.error('Failed to parse user data from URL', e);
        navigate('/login');
      }
    } else {
      console.warn('No user data found in OAuth callback URL');
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-600">Signing you in...</div>
    </div>
  );
}
