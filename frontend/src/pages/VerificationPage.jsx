import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/auth/Button';
import { supabase } from '@/lib/supabase';
import { setTokens } from '@/utils/tokenStorage';

/**
 * VerificationPage Component
 * Handles the post-signup email verification flow using real-time auth listeners
 */
export default function VerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [timeLeft, setTimeLeft] = useState(180); // 180 seconds = 3 minutes
  const [isVerifying, setIsVerifying] = useState(true);
  const [isExpired, setIsExpired] = useState(false);

  // Get user email from location state if available
  const userEmail = location.state?.email || 'your email';

  // Initial loading state transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Periodic polling fallback (in case Real-time fails)
  useEffect(() => {
    if (isExpired) return;

    const checkStatus = async () => {
      try {
        // We check the 'users' table directly via Supabase client (which has the URL/Key)
        const { data, error } = await supabase
          .from('users')
          .select('email_confirmed_at')
          .eq('email', userEmail)
          .single();
        
        if (data?.email_confirmed_at) {
          console.log('Polling: Email confirmation detected!');
          navigate('/dashboard');
        }
      } catch (err) {
        console.debug('Polling check failed');
      }
    };

    // Check every 3 seconds
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [userEmail, navigate, isExpired]);

  // Auth Listener: Listen for session changes (e.g. if link is clicked)
  useEffect(() => {
    // 1. Auth Event Listener (for sessions)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user?.email_confirmed_at) {
        handleSuccess(session);
      }
    });

    // 2. Real-time Database Listener (for specific status change)
    const userSubscription = supabase
      .channel('public:users')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events (INSERT and UPDATE)
          schema: 'public',
          table: 'users'
          // Temporarily removed filter to ensure we catch the event
        },
        (payload) => {
          console.log('Real-time payload received:', payload);
          // Check if this payload belongs to our user AND has email_confirmed_at
          const isOurUser = payload.new && payload.new.email === userEmail;
          
          if (isOurUser && payload.new.email_confirmed_at) {
            console.log('Real-time: Email confirmed detected for:', userEmail);
            handleSuccess({
              user: payload.new,
              access_token: null
            });
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Real-time status:', status);
        if (err) console.error('Real-time Error:', err);
      });

    return () => {
      authSubscription.unsubscribe();
      supabase.removeChannel(userSubscription);
    };
  }, [userEmail, navigate]);

  const handleSuccess = (session) => {
    if (session.access_token) {
      setTokens(session.access_token, session.refresh_token);
      localStorage.setItem('user', JSON.stringify(session.user));
    }
    navigate('/dashboard');
  };

  // Countdown timer logic
  useEffect(() => {
    if (isVerifying || isExpired) return;

    if (timeLeft <= 0) {
      setIsExpired(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, isVerifying, isExpired]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetry = () => {
    navigate('/signup');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
        {isVerifying ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="text-indigo-600 animate-pulse" size={32} />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Verifying user...</h2>
            <p className="text-slate-500">Check your mail</p>
          </div>
        ) : isExpired ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-600" size={40} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Verification Failed</h2>
              <p className="text-slate-500">
                The verification window has expired. Please try signing up again.
              </p>
            </div>
            <Button 
              fullWidth 
              onClick={handleRetry}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <ArrowLeft size={18} />
              Back to Signup
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
                <Mail className="text-indigo-600 animate-bounce" size={40} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Verifying user...</h2>
              <p className="text-slate-500">Check your mail</p>
              <p className="text-sm text-slate-400">
                We sent a link to <span className="font-medium text-slate-600">{userEmail}</span>
              </p>
            </div>
            
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="text-sm font-medium text-indigo-950 mb-1">Time Remaining</div>
              <div className="text-3xl font-mono font-bold text-indigo-600">
                {formatTime(timeLeft)}
              </div>
              <div className="mt-2 h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / 180) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <CheckCircle size={16} className="text-green-500" />
              Waiting for email confirmation...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

