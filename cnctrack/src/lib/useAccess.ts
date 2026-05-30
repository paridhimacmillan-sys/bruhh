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
    fetch('/api/access', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (mounted) setAccess(data);
      })
      .catch(() => {
        if (mounted) setAccess(DEFAULT_ACCESS);
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

