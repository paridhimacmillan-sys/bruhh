import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const isPublicAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico';
  const isLogin = pathname === '/login';
  const isLoggedIn = Boolean(req.auth?.user);

  if (isApi || isPublicAsset) return NextResponse.next();

  if (!isLoggedIn && !isLogin) {
    const url = new URL('/login', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isLogin) {
    const callback = req.nextUrl.searchParams.get('callbackUrl');
    const safe = callback && callback.startsWith('/') ? callback : '/';
    return NextResponse.redirect(new URL(safe, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/'],
};

