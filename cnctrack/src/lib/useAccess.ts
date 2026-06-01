'use client';
import { useEffect, useState } from 'react';

export interface AccessInfo {
  authenticated: boolean;
  email: string | null;
  role: 'admin' | 'employee' | null;
  isAdmin: boolean;
}

const DEFAULT_ACCESS: AccessInfo = {
  authenticated: false,
  email: null,
  role: null,
  isAdmin: false,
};

export function useAccess() {
  const [access, setAccess] = useState<AccessInfo>(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch('/api/me', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) return DEFAULT_ACCESS;
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        setAccess(data?.authenticated ? data : DEFAULT_ACCESS);
      })
      .catch(() => {
        if (!mounted) return;
        setAccess(DEFAULT_ACCESS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { access, loading };
}
