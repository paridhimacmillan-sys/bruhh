import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { auth, signIn } from '@/auth';
import AppLogo from '@/components/ui/AppLogo';

type Props = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

async function loginWithCredentials(formData: FormData) {
  'use server';
  const identifier = String(formData.get('identifier') ?? '');
  const password = String(formData.get('password') ?? '');
  const callbackUrl = String(formData.get('callbackUrl') ?? '/');
  try {
    await signIn('credentials', { identifier, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent(error.type)}`);
    }
    throw error;
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith('/') ? params.callbackUrl : '/';

  if (session?.user) redirect(callbackUrl);

  const hasError = !!params.error;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <AppLogo size={28} className="text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">MachineTrack</h1>
            <p className="text-sm text-muted-foreground mt-1">Production Monitor</p>
          </div>
        </div>

        {/* Admin sign-in — Google */}
        <div className="card-base p-5 rounded-xl space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
            <p className="text-sm font-medium text-foreground mt-0.5">Sign in with your Google account</p>
          </div>
          <a
            href={`/api/login/google?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 text-sm font-semibold border border-border rounded-md bg-card hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Operator sign-in — username/password */}
        <div className="card-base p-5 rounded-xl space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Operator</p>
            <p className="text-sm font-medium text-foreground mt-0.5">Sign in with your username &amp; password</p>
          </div>

          <form action={loginWithCredentials} className="space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="identifier">
                Username
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                placeholder="e.g. raj_operator"
                autoComplete="username"
                autoFocus
                required
                className={`w-full px-3 py-2.5 text-sm border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${hasError ? 'border-danger' : 'border-border'}`}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-muted-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className={`w-full px-3 py-2.5 text-sm border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${hasError ? 'border-danger' : 'border-border'}`}
              />
            </div>

            {hasError && (
              <div className="rounded-md bg-danger/10 border border-danger/20 px-3 py-2">
                <p className="text-xs text-danger font-medium">Incorrect username or password.</p>
                <p className="text-xs text-danger/80 mt-0.5">Admins must use the Google button above, not this form.</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Sign In
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
