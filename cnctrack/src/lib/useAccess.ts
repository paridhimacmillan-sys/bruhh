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

const SWITCH_ID_KEY = 'cnctrack_switch_identity';

function readSwitchIdentity(): Partial<AccessInfo> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const emailFromUrl =
    params.get('email') ??
    params.get('userEmail') ??
    params.get('user_id') ??
    params.get('uid');
  const roleFromUrl = params.get('role');

  if (emailFromUrl) {
    const normalizedEmail = emailFromUrl.toLowerCase();
    const role = roleFromUrl === 'admin' ? 'admin' : roleFromUrl === 'employee' ? 'employee' : null;
    const identity: AccessInfo = {
      authenticated: true,
      email: normalizedEmail,
      role,
      isAdmin: role === 'admin',
    };
    window.localStorage.setItem(SWITCH_ID_KEY, JSON.stringify(identity));
    return identity;
  }

  const raw = window.localStorage.getItem(SWITCH_ID_KEY);
  if (!raw) return {};
  try {
    const saved = JSON.parse(raw) as Partial<AccessInfo>;
    if (!saved?.email) return {};
    return {
      authenticated: true,
      email: String(saved.email).toLowerCase(),
      role: saved.role === 'admin' ? 'admin' : saved.role === 'employee' ? 'employee' : null,
      isAdmin: saved.role === 'admin',
    };
  } catch {
    return {};
  }
}

export function useAccess() {
  const [access, setAccess] = useState<AccessInfo>(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bridgedIdentity = readSwitchIdentity();
    fetch('/api/access', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data?.authenticated) {
          setAccess(data);
          return;
        }
        if (bridgedIdentity.email) {
          setAccess({
            authenticated: true,
            email: bridgedIdentity.email ?? null,
            role: bridgedIdentity.role ?? null,
            isAdmin: bridgedIdentity.role === 'admin',
          });
          return;
        }
        setAccess(DEFAULT_ACCESS);
      })
      .catch(() => {
        if (!mounted) return;
        if (bridgedIdentity.email) {
          setAccess({
            authenticated: true,
            email: bridgedIdentity.email ?? null,
            role: bridgedIdentity.role ?? null,
            isAdmin: bridgedIdentity.role === 'admin',
          });
          return;
        }
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
