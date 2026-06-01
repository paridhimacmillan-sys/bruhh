import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user);
  const isApi = pathname.startsWith('/api/');
  const isLoginPage = pathname === '/login';
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/icons');

  if (isPublicAsset || isApi) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    const url = new URL('/login', req.nextUrl.origin);
    const callbackUrl = `${pathname}${search || ''}`;
    url.searchParams.set('callbackUrl', callbackUrl);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isLoginPage) {
    const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/';
    return NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/'],
};
