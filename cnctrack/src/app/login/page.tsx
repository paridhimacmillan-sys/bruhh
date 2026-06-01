import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

type Props = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

async function loginWithCredentials(formData: FormData) {
  'use server';
  const identifier = String(formData.get('identifier') ?? '');
  const password = String(formData.get('password') ?? '');
  const callbackUrl = String(formData.get('callbackUrl') ?? '/');
  await signIn('credentials', { identifier, password, redirectTo: callbackUrl });
}

async function loginWithGoogle(formData: FormData) {
  'use server';
  const callbackUrl = String(formData.get('callbackUrl') ?? '/');
  await signIn('google', { redirectTo: callbackUrl });
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith('/') ? params.callbackUrl : '/';

  if (session?.user) redirect(callbackUrl);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md card-base p-8 rounded-xl space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Sign in to CNCTrack</h1>
        <p className="text-sm text-muted-foreground">
          Use username/password or continue with Google.
        </p>

        <form action={loginWithCredentials} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input
            name="identifier"
            placeholder="Email or Username"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card"
            required
          />
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Sign in with Username & Password
          </button>
        </form>

        <form action={loginWithGoogle}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
          >
            Continue with Google
          </button>
        </form>

        {params.error ? (
          <p className="text-xs text-danger">Login failed. Please check credentials or try another account.</p>
        ) : null}
      </div>
    </main>
  );
}
