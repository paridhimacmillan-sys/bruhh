import { signIn } from '@/auth';

function getSafeCallbackUrl(request: Request): string {
  const callbackUrl = new URL(request.url).searchParams.get('callbackUrl');
  return callbackUrl?.startsWith('/') ? callbackUrl : '/';
}

export async function GET(request: Request) {
  return signIn('google', { redirectTo: getSafeCallbackUrl(request) });
}
