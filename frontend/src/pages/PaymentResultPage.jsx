import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { workspaceApi } from '@/services/workspaceApi';

const PaymentResultPage = ({ cancelled = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [storageUsage, setStorageUsage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cancelled) return undefined;

    let isMounted = true;
    let attempts = 0;
    let refreshTimer;

    const refreshStatus = () => {
      workspaceApi.getStorageUsage()
        .then((usage) => {
          if (!isMounted) return;
          setStorageUsage(usage);
          window.dispatchEvent(new Event('neuranote:payment-status-updated'));
          if (usage?.plan_code?.toLowerCase() !== 'pro' && attempts < 10) {
            attempts += 1;
            refreshTimer = window.setTimeout(refreshStatus, 2000);
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message || 'Unable to refresh your subscription status.');
        });
    };

    refreshStatus();

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimer);
    };
  }, [cancelled]);

  const planCode = storageUsage?.plan_code || 'free';
  const planName = storageUsage?.plan_name || (planCode === 'pro' ? 'Pro' : 'Free');
  const isPro = planCode.toLowerCase() === 'pro';

  return (
    <main style={{
      minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', background: '#fafafa',
    }}>
      <section style={{
        width: '100%', maxWidth: '560px', padding: '32px', borderRadius: '16px',
        background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 12px 30px rgba(20, 20, 40, 0.08)',
      }}>
        <p style={{ margin: '0 0 10px', color: '#6b4ce6', fontSize: '12px', fontWeight: '700', letterSpacing: '0.08em' }}>
          NEURANOTE PRO
        </p>
        <h1 style={{ margin: '0 0 12px', color: '#1a1a2e', fontSize: '28px' }}>
          {cancelled ? 'Payment cancelled' : 'Payment completed'}
        </h1>
        {cancelled ? (
          <p style={{ margin: '0 0 24px', color: '#5f6472', lineHeight: 1.6 }}>
            No charge was applied. Your account remains on its current plan.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 16px', color: '#5f6472', lineHeight: 1.6 }}>
              Your payment was completed. We are refreshing your Pro subscription from the verified backend payment notification.
            </p>
            {error ? (
              <p style={{ margin: '0 0 24px', color: '#b42318', lineHeight: 1.5 }}>{error}</p>
            ) : storageUsage ? (
              <p style={{ margin: '0 0 24px', color: isPro ? '#087443' : '#8a5a00', lineHeight: 1.5 }}>
                Backend-reported plan: <strong>{planName}</strong> ({planCode.toUpperCase()}).
                {!isPro && ' The PayHere notification may still be processing.'}
              </p>
            ) : (
              <p style={{ margin: '0 0 24px', color: '#5f6472' }}>Refreshing subscription status...</p>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => navigate('/dashboard', { state: { paymentReturn: location.pathname } })}
          style={{
            border: 'none', borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
            background: '#6b4ce6', color: '#fff', fontWeight: '700',
          }}
        >
          Return to NeuraNote
        </button>
      </section>
    </main>
  );
};

export default PaymentResultPage;
