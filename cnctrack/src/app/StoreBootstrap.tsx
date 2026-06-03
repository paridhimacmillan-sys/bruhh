'use client';
import { useEffect, useState } from 'react';
import { bootstrapStore, refreshStore, subscribe, getBootstrapError } from '@/lib/store';
import { bootstrapShifts } from '@/lib/shifts';
import { bootstrapOperators } from '@/lib/operators';

export default function StoreBootstrap() {
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    bootstrapStore();
    bootstrapShifts();
    bootstrapOperators().catch((e) => console.warn('[MachineTrack] Operator bootstrap failed:', e));

    const refreshFromDb = () => {
      refreshStore().catch((e) => console.warn('[MachineTrack] Focus refresh failed:', e));
      bootstrapShifts();
      bootstrapOperators().catch((e) => console.warn('[MachineTrack] Operator focus refresh failed:', e));
    };
    window.addEventListener('focus', refreshFromDb);

    // Mirror store error state into local React state so we can render a banner.
    const unsub = subscribe(() => {
      const err = getBootstrapError();
      setError(err);
      // Stale session: redirect to login so NextAuth re-mints the JWT with a fresh organizationId.
      if (err === 'SESSION_INVALID') {
        window.location.href = '/api/auth/signin?error=SessionExpired';
      }
    });

    return () => {
      window.removeEventListener('focus', refreshFromDb);
      unsub();
    };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      await refreshStore();
      await bootstrapShifts();
      await bootstrapOperators();
    } catch {
      // error will be set again via the subscribe listener above
    } finally {
      setRetrying(false);
    }
  };

  if (!error || error === 'SESSION_INVALID') return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        background: '#fef2f2',
        border: '1px solid #fca5a5',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '420px',
        width: 'calc(100% - 2rem)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="#dc2626" aria-hidden>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zm.75 7.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
      <span style={{ flex: 1, fontSize: '0.875rem', color: '#991b1b' }}>
        Could not load production data. Check your connection.
      </span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        style={{
          padding: '0.25rem 0.75rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#fff',
          background: retrying ? '#9ca3af' : '#dc2626',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: retrying ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}
