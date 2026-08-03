import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  getAuthMeQueryKey,
  useAuthMe,
  useAuthRequestOtp,
  useAuthVerifyOtp,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageToggle, useLanguage } from "@/lib/language";

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  return null;
}

export function LoginPage() {
  const { text } = useLanguage();
  const [, navigate] = useLocation();
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [resendSeconds, setResendSeconds] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { data: currentUser } = useAuthMe({ query: { queryKey: getAuthMeQueryKey(), retry: false } });

  const returnToParam = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = returnToParam?.startsWith("/") && !returnToParam.startsWith("//") ? returnToParam : "/dispatch";

  useEffect(() => {
    if (currentUser) navigate(returnTo, { replace: true });
  }, [currentUser, navigate, returnTo]);

  useEffect(() => {
    if (stage !== "otp" || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds, stage]);

  const requestOtp = useAuthRequestOtp({
    mutation: {
      onSuccess: () => {
        setStage("otp");
        setDigits(["", "", "", "", "", ""]);
        setResendSeconds(30);
        window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
      },
    },
  });

  const verifyOtp = useAuthVerifyOtp({
    mutation: {
      onSuccess: () => navigate(returnTo, { replace: true }),
    },
  });

  function submitPhone() {
    const normalized = phone.replace(/\D/g, "");
    if (/^[6-9][0-9]{9}$/.test(normalized)) {
      requestOtp.mutate({ data: { phone: normalized } });
    }
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    inputRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  function submitOtp() {
    const code = digits.join("");
    if (code.length === 6) verifyOtp.mutate({ data: { phone, code } });
  }

  const displayedError = errorMessage(stage === "phone" ? requestOtp.error : verifyOtp.error);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-5 py-4">
          <Link href="/" className="font-display text-lg tracking-tight" aria-label="StubbleX home">
            Stubble<span className="text-primary">X</span>
          </Link>
          <div className="flex items-center gap-2"><span className="eyebrow hidden sm:inline">{text("Operator access", "ਓਪਰੇਟਰ ਪਹੁੰਚ", "ऑपरेटर प्रवेश")}</span><LanguageToggle /></div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-8 sm:px-6">
        <section className="w-full max-w-md rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_60px_-30px_oklch(0.36_0.055_152_/_0.45)]">
          <div className="rounded-[1.5rem] border border-border px-5 py-8 sm:px-8 sm:py-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-straw text-straw-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>

            {stage === "phone" ? (
              <form
                className="mt-7"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitPhone();
                }}
              >
                <p className="eyebrow">{text("Passwordless sign in", "ਬਿਨਾਂ ਪਾਸਵਰਡ ਸਾਈਨ ਇਨ", "बिना पासवर्ड साइन इन")}</p>
                <h1 className="mt-3 font-display text-4xl leading-tight">{text("Welcome back", "ਜੀ ਆਇਆਂ ਨੂੰ", "वापसी पर स्वागत है")}</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text("Sign in to the Sangrur dispatch ledger with your registered operator number.", "ਆਪਣੇ ਦਰਜ ਓਪਰੇਟਰ ਨੰਬਰ ਨਾਲ ਸੰਗਰੂਰ ਡਿਸਪੈਚ ਲੇਜ਼ਰ ਵਿੱਚ ਸਾਈਨ ਇਨ ਕਰੋ।", "अपने पंजीकृत ऑपरेटर नंबर से संगरूर डिस्पैच लेज़र में साइन इन करें।")}</p>

                <label htmlFor="operator-phone" className="mt-8 block text-sm font-medium">
                  {text("Mobile number", "ਮੋਬਾਈਲ ਨੰਬਰ", "मोबाइल नंबर")}
                </label>
                <div className="mt-2 flex rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="flex items-center border-r border-border px-3 text-sm text-muted-foreground">+91</span>
                  <Input
                    id="operator-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 00003"
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>

                {displayedError && <p role="alert" className="mt-3 text-sm text-destructive">{displayedError}</p>}

                <Button type="submit" size="lg" className="mt-6 w-full text-base" disabled={phone.length !== 10 || requestOtp.isPending}>
                  {requestOtp.isPending ? text("Sending…", "ਭੇਜ ਰਹੇ ਹਾਂ…", "भेज रहे हैं…") : text("Send OTP", "OTP ਭੇਜੋ", "OTP भेजें")}
                </Button>
              </form>
            ) : (
              <form
                className="mt-7"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitOtp();
                }}
              >
                <button type="button" onClick={() => setStage("phone")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {text("Change number", "ਨੰਬਰ ਬਦਲੋ", "नंबर बदलें")}
                </button>
                <p className="eyebrow mt-6">{text("One-time password", "ਇੱਕ ਵਾਰ ਦਾ ਪਾਸਵਰਡ", "एक बार का पासवर्ड")}</p>
                <h1 className="mt-3 font-display text-4xl leading-tight">{text("Enter your OTP", "ਆਪਣਾ OTP ਭਰੋ", "अपना OTP दर्ज करें")}</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text("Sent to", "ਭੇਜਿਆ", "भेजा गया")} +91 {phone.slice(0, 5)} {phone.slice(5)}</p>

                <label className="mt-8 block text-sm font-medium">
                  {text("Verification code", "ਪੁਸ਼ਟੀਕਰਨ ਕੋਡ", "सत्यापन कोड")}
                </label>
                <div className="mt-3 grid grid-cols-6 gap-2" onPaste={handlePaste}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { inputRefs.current[index] = element; }}
                      aria-label={`OTP digit ${index + 1}`}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      onChange={(event) => updateDigit(index, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(index, event)}
                      className="aspect-square min-w-0 rounded-md border border-input bg-background text-center font-mono text-xl outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
                    />
                  ))}
                </div>

                {displayedError && <p role="alert" className="mt-3 text-sm text-destructive">{displayedError}</p>}

                <Button type="submit" size="lg" className="mt-6 w-full" disabled={digits.some((digit) => !digit) || verifyOtp.isPending}>
                  {verifyOtp.isPending ? text("Verifying…", "ਪੁਸ਼ਟੀ ਕਰ ਰਹੇ ਹਾਂ…", "सत्यापित कर रहे हैं…") : text("Verify OTP", "OTP ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ", "OTP सत्यापित करें")}
                </Button>

                <div className="mt-5 text-center text-xs text-muted-foreground">
                  {resendSeconds > 0 ? (
                    <span>{text(`Resend OTP in ${resendSeconds}s`, `${resendSeconds}s ਵਿੱਚ OTP ਮੁੜ ਭੇਜੋ`, `${resendSeconds}s में OTP फिर भेजें`)}</span>
                  ) : (
                    <button type="button" className="font-medium text-primary" disabled={requestOtp.isPending} onClick={submitPhone}>
                      {text("Resend OTP", "OTP ਮੁੜ ਭੇਜੋ", "OTP फिर भेजें")}
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className="mt-8 flex items-start gap-2 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {text("No password is created or stored. Access is verified only through your registered phone.", "ਕੋਈ ਪਾਸਵਰਡ ਬਣਾਇਆ ਜਾਂ ਸੰਭਾਲਿਆ ਨਹੀਂ ਜਾਂਦਾ। ਪਹੁੰਚ ਸਿਰਫ਼ ਤੁਹਾਡੇ ਦਰਜ ਫ਼ੋਨ ਰਾਹੀਂ ਤਸਦੀਕ ਹੁੰਦੀ ਹੈ।", "कोई पासवर्ड बनाया या रखा नहीं जाता। प्रवेश केवल आपके पंजीकृत फ़ोन से सत्यापित होता है।")}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
