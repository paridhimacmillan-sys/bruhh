import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export type Language = "pa" | "hi" | "en";

const STORAGE_KEY = "stubblex_language";

function normalizeLanguage(value: string | null): Language | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "pa" || normalized === "punjabi" || normalized === "ਪੰਜਾਬੀ") return "pa";
  if (normalized === "hi" || normalized === "hindi" || normalized === "हिन्दी" || normalized === "हिंदी") return "hi";
  if (normalized === "en" || normalized === "english") return "en";
  return null;
}

function savedLanguage(): Language | null {
  const local = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
  if (local) return local;
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${STORAGE_KEY}=`));
  return normalizeLanguage(cookie?.split("=")[1] ?? null);
}

function initialLanguage(): Language | null {
  const params = new URLSearchParams(window.location.search);
  if (params.has("lang")) return normalizeLanguage(params.get("lang")) ?? "en";
  const saved = savedLanguage();
  if (saved) return saved;
  if (window.location.pathname.includes("/r/")) return "pa";
  return null;
}

export const farmerReceiptDictionary = {
  confirmation: { pa: "ਤੁਹਾਡੀ ਪਰਾਲੀ ਵਿਕ ਗਈ", hi: "आपकी पराली बिक गई", en: "Your parali is sold" },
  receipt: { pa: "ਕਿਸਾਨ ਰਸੀਦ", hi: "किसान रसीद", en: "Farmer receipt" },
  weight: { pa: "ਵਜ਼ਨ", hi: "वज़न", en: "Weight" },
  tonnes: { pa: "ਟਨ", hi: "टन", en: "tonnes" },
  amountPaid: { pa: "ਤੁਹਾਡੀ ਰਕਮ", hi: "आपकी राशि", en: "Amount paid" },
  fpoAccount: { pa: "FPO ਖਾਤੇ ਵਿੱਚ", hi: "FPO खाते में", en: "in your FPO account" },
  paymentDate: { pa: "ਭੁਗਤਾਨ ਦੀ ਮਿਤੀ", hi: "भुगतान की तारीख", en: "Payment date" },
  baled: { pa: "ਗੱਠਾਂ ਬਣੀਆਂ", hi: "गट्ठे बने", en: "baled" },
  weighed: { pa: "ਤੋਲਿਆ ਗਿਆ", hi: "तोला गया", en: "weighed" },
  paid: { pa: "ਪੈਸੇ ਮਿਲੇ", hi: "पैसे मिले", en: "paid" },
  cluster: { pa: "ਕਲੱਸਟਰ", hi: "क्लस्टर", en: "Cluster" },
  weighbridge: { pa: "ਵੇਅਬ੍ਰਿਜ", hi: "वेब्रिज", en: "Weighbridge" },
  footer: { pa: "ਅੱਗ ਨਹੀਂ, ਆਮਦਨ", hi: "आग नहीं, आमदनी", en: "Not fire, income" },
  notFound: { pa: "ਰਸੀਦ ਨਹੀਂ ਮਿਲੀ", hi: "रसीद नहीं मिली", en: "Receipt not found" },
  tryAgain: { pa: "ਲਿੰਕ ਜਾਂਚ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", hi: "लिंक जांचकर फिर कोशिश करें।", en: "Check the link and try again." },
} as const;

export type FarmerReceiptCopyKey = keyof typeof farmerReceiptDictionary;

type LanguageContextValue = {
  language: Language | null;
  setLanguage: (language: Language) => void;
  text: (english: string, punjabi: string, hindi: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(initialLanguage);

  const setLanguage = (next: Language) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${STORAGE_KEY}=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
    document.documentElement.lang = next === "pa" ? "pa" : next === "hi" ? "hi" : "en";
    setLanguageState(next);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("lang")) setLanguage(normalizeLanguage(params.get("lang")) ?? "en");
    else if (language) document.documentElement.lang = language;
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    text: (english, punjabi, hindi) => language === "pa" ? punjabi : language === "hi" ? hindi : english,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function useFarmerReceiptCopy() {
  const { language } = useLanguage();
  return (key: FarmerReceiptCopyKey) => farmerReceiptDictionary[key][language ?? "pa"];
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={`inline-flex items-center rounded-full border border-border bg-card p-0.5 text-[0.65rem] font-medium ${className}`} aria-label="Change language">
      {([[
        "pa", "ਪੰ",
      ], ["hi", "हि"], ["en", "EN"]] as const).map(([value, label], index) => (
        <span key={value} className="inline-flex items-center">{index > 0 && <span className="text-border" aria-hidden="true">|</span>}<button type="button" lang={value} onClick={() => setLanguage(value)} aria-pressed={language === value} className={`min-h-7 rounded-full px-2 transition-colors ${language === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button></span>
      ))}
    </div>
  );
}

function LanguageChooser() {
  const { setLanguage } = useLanguage();
  const choices: Array<{ language: Language; label: string; helper: string }> = [
    { language: "pa", label: "ਪੰਜਾਬੀ", helper: "ਪੰਜਾਬੀ ਵਿੱਚ ਜਾਰੀ ਰੱਖੋ" },
    { language: "hi", label: "हिन्दी", helper: "हिन्दी में जारी रखें" },
    { language: "en", label: "English", helper: "Continue in English" },
  ];
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-xl text-center" aria-labelledby="language-heading">
        <div className="font-display text-2xl tracking-tight">Unpack<span className="text-primary">os</span></div>
        <p className="eyebrow mt-4">Punjab crop-residue marketplace</p>
        <h1 id="language-heading" className="mt-7 font-display text-3xl leading-tight sm:text-4xl">Choose your language · ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ · अपनी भाषा चुनें</h1>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {choices.map((choice) => (
            <button key={choice.language} type="button" lang={choice.language} onClick={() => setLanguage(choice.language)} className="min-h-20 rounded-lg border border-border bg-card px-5 py-4 text-left transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block font-display text-2xl">{choice.label}</span>
              <span className="mt-1 block text-[0.65rem] text-muted-foreground">{choice.helper}</span>
            </button>
          ))}
        </div>
        <p className="mt-7 text-xs text-muted-foreground">You can change this later from the language control in the header.</p>
      </section>
    </main>
  );
}

export function PublicLanguageGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { language } = useLanguage();
  if (location === "/dispatch" || location.startsWith("/dispatch/")) return children;
  if (!language) return <LanguageChooser />;
  return children;
}
