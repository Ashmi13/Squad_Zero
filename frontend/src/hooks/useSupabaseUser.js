import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const getUserScope = (user) => {
  if (user?.id) {
    return String(user.id);
  }

  if (user?.email) {
    return String(user.email).trim().toLowerCase();
  }

  return 'anonymous';
};

export const getScopedStorageKey = (baseKey, scope) => `${baseKey}:${encodeURIComponent(scope || 'anonymous')}`;

export const useSupabaseUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;

        if (error) {
          setUser(null);
          return;
        }

        setUser(data?.session?.user || null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSession();

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  return {
    user,
    userScope: getUserScope(user),
    loading,
  };
};