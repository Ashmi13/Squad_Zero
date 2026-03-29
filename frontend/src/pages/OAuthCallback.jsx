import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setTokens } from '@/utils/tokenStorage';

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const params = new URLSearchParams(hash);

    const access = params.get('access');
    const refresh = params.get('refresh');
    const email = params.get('email');
    const fullName = params.get('name');
    const id = params.get('id');

    if (access && refresh && email) {
      setTokens(access, refresh);
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: id || 'oauth-user',
          email,
          full_name: fullName || '',
        })
      );
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-600">Signing you in...</div>
    </div>
  );
}
