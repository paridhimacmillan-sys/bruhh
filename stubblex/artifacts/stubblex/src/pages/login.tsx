import { useEffect } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { getAuthMeQueryKey, useAuthMe } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { LanguageToggle, useLanguage } from "@/lib/language";

const loginErrors: Record<string, string> = {
  google_not_configured: "Google Sign-In has not been configured on the server yet.",
  invalid_login_state: "That login attempt expired. Please try again.",
  google_exchange_failed: "Google could not complete the login. Please try again.",
  unverified_google_account: "Use a verified Google account.",
  not_approved: "This Google email has not been approved for Unpackos staff access.",
  google_account_mismatch: "This staff account is linked to a different Google account.",
};

function GoogleMark() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.87A6.01 6.01 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.62Z"/><path fill="#EA4335" d="M12 6c1.47 0 2.8.51 3.84 1.5l2.87-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z"/></svg>;
}

export function LoginPage() {
  const { text } = useLanguage();
  const [, navigate] = useLocation();
  const { data: currentUser } = useAuthMe({ query: { queryKey: getAuthMeQueryKey(), retry: false } });
  const returnToParam = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = returnToParam?.startsWith("/") && !returnToParam.startsWith("//") ? returnToParam : "/dispatch";
  const errorCode = new URLSearchParams(window.location.search).get("error") ?? "";

  useEffect(() => {
    if (currentUser) navigate(returnTo, { replace: true });
  }, [currentUser, navigate, returnTo]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-5 py-4">
          <Link href="/" className="font-display text-lg tracking-tight" aria-label="Unpackos home">Unpack<span className="text-primary">os</span></Link>
          <div className="flex items-center gap-2"><span className="eyebrow hidden sm:inline">{text("Staff access", "ਸਟਾਫ਼ ਪਹੁੰਚ", "स्टाफ़ प्रवेश")}</span><LanguageToggle /></div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-8 sm:px-6">
        <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_60px_-30px_oklch(0.36_0.055_152_/_0.45)]">
          <div className="rounded-[1.5rem] border border-border px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-straw text-straw-foreground"><ShieldCheck className="h-5 w-5" /></div>
            <p className="eyebrow mt-7">{text("Approved staff only", "ਸਿਰਫ਼ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਸਟਾਫ਼", "केवल स्वीकृत स्टाफ़")}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight">{text("Sign in to Unpackos", "Unpackos ਵਿੱਚ ਸਾਈਨ ਇਨ ਕਰੋ", "Unpackos में साइन इन करें")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text("Use the Google account email approved by your Unpackos administrator.", "ਆਪਣੇ Unpackos ਐਡਮਿਨ ਵੱਲੋਂ ਮਨਜ਼ੂਰ Google ਈਮੇਲ ਵਰਤੋ।", "अपने Unpackos एडमिन द्वारा स्वीकृत Google ईमेल का उपयोग करें।")}</p>

            {errorCode && <p role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loginErrors[errorCode] ?? "Sign-in was not completed. Please try again."}</p>}

            <a href="/api/auth/google" className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <GoogleMark /> {text("Continue with Google", "Google ਨਾਲ ਜਾਰੀ ਰੱਖੋ", "Google से जारी रखें")}
            </a>

            <div className="mt-7 space-y-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />No passwords or paid SMS codes are handled by Unpackos.</p>
              <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />Your email must already be present in the approved staff list.</p>
            </div>
            <Link href="/" className="mt-7 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back to public website</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
