import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl && params.callbackUrl.startsWith('/') ? params.callbackUrl : '/';

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md card-base p-8 rounded-xl">
        <h1 className="text-2xl font-bold text-foreground">Sign in to CNCTrack</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Use your organization Google account to access production dashboards and entries.
        </p>

        <a
          href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue with Google
        </a>

        <p className="text-xs text-muted-foreground mt-4">
          If you switched from Rejection Mapper, sign in with the same Google account to keep role mapping.
        </p>

        <div className="mt-6 text-xs text-muted-foreground">
          Need help? Go back to <Link href="/" className="text-primary font-medium">home</Link>.
        </div>
      </div>
    </main>
  );
}

