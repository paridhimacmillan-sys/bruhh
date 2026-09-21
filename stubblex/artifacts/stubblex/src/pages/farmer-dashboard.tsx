import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, IndianRupee, Phone, Plus, ShieldCheck, Truck, Volume2 } from "lucide-react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageToggle, useLanguage } from "@/lib/language";

type BatchStatus = "registered" | "baled" | "paid" | "delivered";
type FarmerDashboard = {
  farmer: { name: string; fpoName: string; listedTonnes: number; clusterName: string; district: string };
  operator: { name: string; phone: string } | null;
  batches: Array<{ id: number; status: BatchStatus; weightTonnes: number; farmerPaidInr: number; pickupScheduledAt: string | null; baledAt: string; weighbridgeId: string }>;
  totalCollectedTonnes: number;
  totalPaidInr: number;
  pendingCallback: { id: number; additionalTonnes: number; createdAt: string } | null;
};

function demoTimestamp(daysFromToday: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const previewData: FarmerDashboard = {
  farmer: { name: "Gurpreet Singh", fpoName: "Sunam Kisan Producer Company", listedTonnes: 20, clusterName: "Sunam North", district: "Sangrur" },
  operator: { name: "Jagmeet Singh", phone: "9876500003" },
  batches: [
    { id: 432, status: "registered", weightTonnes: 6, farmerPaidInr: 0, pickupScheduledAt: demoTimestamp(3, 8), baledAt: demoTimestamp(3, 8), weighbridgeId: "Pending" },
    { id: 431, status: "delivered", weightTonnes: 4.2, farmerPaidInr: 1680, pickupScheduledAt: demoTimestamp(-4, 8), baledAt: demoTimestamp(-4, 8), weighbridgeId: "WB-SUN-114" },
  ],
  totalCollectedTonnes: 4.2,
  totalPaidInr: 1680,
  pendingCallback: null,
};

const statusOrder: Record<BatchStatus, number> = { registered: 0, baled: 1, paid: 2, delivered: 3 };

export function FarmerDashboardPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { language, text } = useLanguage();
  const isPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const [data, setData] = useState<FarmerDashboard | null>(isPreview ? previewData : null);
  const [loading, setLoading] = useState(!isPreview);
  const [notFound, setNotFound] = useState(false);
  const [additionalTonnes, setAdditionalTonnes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    if (isPreview) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/farmer-dashboard/${encodeURIComponent(token)}`, { signal: controller.signal, credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "not-found" : "load-failed");
        return response.json() as Promise<FarmerDashboard>;
      })
      .then(setData)
      .catch((error: Error) => { if (error.name !== "AbortError") setNotFound(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isPreview, token]);

  const locale = language === "pa" ? "pa-IN" : language === "hi" ? "hi-IN" : "en-IN";
  const formatNumber = (value: number, digits = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const formatAmount = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  const formatDate = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date(value));
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const months = language === "pa"
      ? ["ਜਨਵਰੀ", "ਫ਼ਰਵਰੀ", "ਮਾਰਚ", "ਅਪ੍ਰੈਲ", "ਮਈ", "ਜੂਨ", "ਜੁਲਾਈ", "ਅਗਸਤ", "ਸਤੰਬਰ", "ਅਕਤੂਬਰ", "ਨਵੰਬਰ", "ਦਸੰਬਰ"]
      : language === "hi"
        ? ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"]
        : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${number("day")} ${months[number("month") - 1]} ${number("year")}`;
  };
  const formatTime = (value: string) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
  const formatTimeWindow = (value: string) => `${formatTime(value)} – ${formatTime(new Date(new Date(value).getTime() + 3 * 60 * 60 * 1000).toISOString())}`;
  const currentBatch = useMemo(() => data?.batches.find((batch) => statusOrder[batch.status] < 3) ?? data?.batches[0] ?? null, [data]);
  const remainingTonnes = Math.max(0, data ? data.farmer.listedTonnes - data.totalCollectedTonnes : 0);
  const collectedPercent = data?.farmer.listedTonnes ? Math.min(100, Math.round((data.totalCollectedTonnes / data.farmer.listedTonnes) * 100)) : 0;

  function speakSummary() {
    if (!data || !("speechSynthesis" in window)) return;
    const summary = text(
      `${data.totalCollectedTonnes} of ${data.farmer.listedTonnes} tonnes have been collected. ${remainingTonnes} tonnes remain. ${formatAmount(data.totalPaidInr)} has been paid to your FPO account.`,
      `${formatNumber(data.farmer.listedTonnes)} ਟਨ ਵਿੱਚੋਂ ${formatNumber(data.totalCollectedTonnes)} ਟਨ ਚੁੱਕੀ ਗਈ ਹੈ। ${formatNumber(remainingTonnes)} ਟਨ ਬਾਕੀ ਹੈ। ${formatAmount(data.totalPaidInr)} ਤੁਹਾਡੇ FPO ਖਾਤੇ ਵਿੱਚ ਦਿੱਤੇ ਗਏ ਹਨ।`,
      `${formatNumber(data.farmer.listedTonnes)} टन में से ${formatNumber(data.totalCollectedTonnes)} टन उठाई गई है। ${formatNumber(remainingTonnes)} टन बाकी है। ${formatAmount(data.totalPaidInr)} आपके FPO खाते में दिए गए हैं।`,
    );
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.lang = language === "pa" ? "pa-IN" : language === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  async function requestCallback() {
    const tonnes = Number(additionalTonnes);
    if (!Number.isFinite(tonnes) || tonnes < 0.1 || tonnes > 500) {
      setRequestMessage(text("Enter the extra tonnes available.", "ਹੋਰ ਉਪਲਬਧ ਟਨ ਲਿਖੋ।", "अतिरिक्त उपलब्ध टन लिखें।"));
      return;
    }
    if (isPreview) {
      setData((current) => current ? { ...current, pendingCallback: { id: 1, additionalTonnes: tonnes, createdAt: new Date().toISOString() } } : current);
      setRequestMessage(text("Request sent. Your operator will call you.", "ਬੇਨਤੀ ਭੇਜੀ ਗਈ। ਤੁਹਾਡਾ ਓਪਰੇਟਰ ਤੁਹਾਨੂੰ ਫ਼ੋਨ ਕਰੇਗਾ।", "अनुरोध भेज दिया गया। आपका ऑपरेटर आपको फ़ोन करेगा।"));
      return;
    }
    setSubmitting(true);
    setRequestMessage("");
    try {
      const response = await fetch(`/api/farmer-dashboard/${encodeURIComponent(token)}/more-stubble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ additionalTonnes: tonnes }),
      });
      const result = await response.json() as { id?: number; createdAt?: string; message?: string };
      if (!response.ok) throw new Error(result.message ?? "Request failed");
      setData((current) => current ? { ...current, pendingCallback: { id: result.id ?? 0, additionalTonnes: tonnes, createdAt: result.createdAt ?? new Date().toISOString() } } : current);
      setRequestMessage(text("Request sent. Your operator will call you.", "ਬੇਨਤੀ ਭੇਜੀ ਗਈ। ਤੁਹਾਡਾ ਓਪਰੇਟਰ ਤੁਹਾਨੂੰ ਫ਼ੋਨ ਕਰੇਗਾ।", "अनुरोध भेज दिया गया। आपका ऑपरेटर आपको फ़ोन करेगा।"));
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : text("Please try again.", "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "फिर कोशिश करें।"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="min-h-screen animate-pulse bg-background px-5 py-8"><div className="mx-auto h-16 max-w-lg rounded-lg bg-secondary" /><div className="mx-auto mt-6 h-[34rem] max-w-lg rounded-lg bg-secondary" /></main>;
  if (notFound || !data) return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center"><div><p className="font-display text-2xl">Stubble<span className="text-primary">X</span></p><h1 className="mt-7 text-3xl font-bold">{text("Farmer dashboard not found", "ਕਿਸਾਨ ਡੈਸ਼ਬੋਰਡ ਨਹੀਂ ਮਿਲਿਆ", "किसान डैशबोर्ड नहीं मिला")}</h1><p className="mt-3 text-lg text-muted-foreground">{text("Check the private SMS link and try again.", "ਨਿੱਜੀ SMS ਲਿੰਕ ਜਾਂਚ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "निजी SMS लिंक जाँचकर फिर कोशिश करें।")}</p><LanguageToggle className="mt-6" /></div></main>;

  return <div className="min-h-screen bg-secondary/35 text-foreground">
    <header className="border-b border-border bg-background"><div className="mx-auto flex min-h-16 max-w-lg items-center justify-between px-5"><p className="font-display text-2xl">Stubble<span className="text-primary">X</span></p><LanguageToggle /></div></header>
    <main className="mx-auto max-w-lg px-4 py-6 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{text("Farmer dashboard", "ਕਿਸਾਨ ਡੈਸ਼ਬੋਰਡ", "किसान डैशबोर्ड")}</p><h1 className="mt-2 font-display text-4xl leading-tight">{text("Sat Sri Akal", "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ", "नमस्ते")}, {data.farmer.name}</h1><p className="mt-2 text-lg text-muted-foreground">{data.farmer.clusterName}, {data.farmer.district}</p></div>
        <button type="button" onClick={speakSummary} className="grid min-h-14 min-w-14 place-items-center rounded-full border border-border bg-card text-primary shadow-sm" aria-label={text("Listen to summary", "ਸੰਖੇਪ ਸੁਣੋ", "सारांश सुनें")}><Volume2 className="h-6 w-6" /></button>
      </div>

      <section className="mt-6 rounded-2xl border-2 border-primary bg-card p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{text("What happens next", "ਹੁਣ ਅੱਗੇ ਕੀ ਹੋਵੇਗਾ", "अब आगे क्या होगा")}</p>
        <div className="mt-4 flex items-start gap-3"><CalendarDays className="mt-1 h-7 w-7 shrink-0 text-primary" /><div><p className="text-sm font-semibold text-muted-foreground">{text("Next pickup", "ਅਗਲੀ ਚੁੱਕਾਈ", "अगला उठान")}</p><p className="mt-1 text-2xl font-bold">{currentBatch?.pickupScheduledAt ? formatDate(currentBatch.pickupScheduledAt) : text("Being scheduled", "ਤਾਰੀਖ਼ ਤੈਅ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ", "तारीख तय की जा रही है")}</p>{currentBatch?.pickupScheduledAt && <p className="mt-1 text-base font-semibold text-muted-foreground">{formatTimeWindow(currentBatch.pickupScheduledAt)} · {text("About", "ਲਗਭਗ", "लगभग")} {formatNumber(currentBatch.weightTonnes)} {text("tonnes", "ਟਨ", "टन")}</p>}</div></div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-3 text-base font-semibold"><Truck className="h-5 w-5 text-primary" />{currentBatch ? nextStepLabel(currentBatch.status, text) : text("Registration accepted", "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਮਨਜ਼ੂਰ", "पंजीकरण स्वीकृत")}</div>
        {data.operator && <div className="mt-4 border-t border-border pt-4"><p className="text-sm text-muted-foreground">{text("Your field operator", "ਤੁਹਾਡਾ ਫ਼ੀਲਡ ਓਪਰੇਟਰ", "आपका फील्ड ऑपरेटर")}</p><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xl font-bold">{data.operator.name}</p><a href={`tel:+91${data.operator.phone}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground"><Phone className="h-5 w-5" />{text("Call", "ਫ਼ੋਨ ਕਰੋ", "फ़ोन करें")}</a></div></div>}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("This season", "ਇਸ ਸੀਜ਼ਨ", "इस सीज़न")}</p><h2 className="mt-1 text-2xl font-bold">{formatNumber(data.totalCollectedTonnes)} / {formatNumber(data.farmer.listedTonnes)} {text("tonnes collected", "ਟਨ ਚੁੱਕੀ ਗਈ", "टन उठाई गई")}</h2></div><span className="text-2xl font-bold text-primary">{collectedPercent}%</span></div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={collectedPercent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${collectedPercent}%` }} /></div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label={text("You reported", "ਤੁਸੀਂ ਦੱਸਿਆ", "आपने बताया")} value={`${formatNumber(data.farmer.listedTonnes)} t`} />
          <MiniStat label={text("Collected", "ਚੁੱਕੀ ਗਈ", "उठाई गई")} value={`${formatNumber(data.totalCollectedTonnes)} t`} />
          <MiniStat label={text("Still remaining", "ਹਾਲੇ ਬਾਕੀ", "अभी बाकी")} value={`${formatNumber(remainingTonnes)} t`} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-primary/5 px-4 py-4"><div className="flex items-center gap-2"><IndianRupee className="h-5 w-5 text-primary" /><span className="text-sm font-semibold text-muted-foreground">{text("Money received in FPO account", "FPO ਖਾਤੇ ਵਿੱਚ ਮਿਲੇ ਪੈਸੇ", "FPO खाते में मिले पैसे")}</span></div><strong className="text-2xl">{formatAmount(data.totalPaidInr)}</strong></div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="farmer-progress-title">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("This pickup status", "ਇਸ ਚੁੱਕਾਈ ਦੀ ਸਥਿਤੀ", "इस उठान की स्थिति")}</p><h2 id="farmer-progress-title" className="mt-1 text-2xl font-bold">{nextStepLabel(currentBatch?.status ?? "registered", text)}</h2></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{Math.min(4, statusOrder[currentBatch?.status ?? "registered"] + 1)}/4</span></div>
        <ol className="mt-5 grid gap-3">
          {[
            { key: "registered", label: text("Registration accepted", "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਮਨਜ਼ੂਰ", "पंजीकरण स्वीकार") },
            { key: "baled", label: text("Collected and weighed", "ਇਕੱਠੀ ਕਰਕੇ ਤੋਲੀ ਗਈ", "एकत्रित और तोला गया") },
            { key: "paid", label: text("Payment sent", "ਭੁਗਤਾਨ ਭੇਜਿਆ ਗਿਆ", "भुगतान भेजा गया") },
            { key: "delivered", label: text("Delivered to buyer", "ਖਰੀਦਦਾਰ ਤੱਕ ਪਹੁੰਚੀ", "खरीदार तक पहुँचा") },
          ].map((step, index) => {
            const complete = statusOrder[currentBatch?.status ?? "registered"] >= index;
            const current = statusOrder[currentBatch?.status ?? "registered"] === index;
            return <li key={step.key} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 ${current ? "border-primary bg-primary/5" : complete ? "border-emerald-200 bg-emerald-50" : "border-border bg-secondary/25"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${complete ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{complete ? "✓" : index + 1}</span><span className="text-base font-semibold">{step.label}</span></li>;
          })}
        </ol>
      </section>

      <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><div className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-primary" /><div><p className="text-sm font-bold uppercase tracking-[0.12em]">{text("Field verification", "ਖੇਤ ਦੀ ਜਾਂਚ", "खेत का सत्यापन")}</p><ul className="mt-3 space-y-2 text-base font-semibold"><li>✓ {text("Field inspected", "ਖੇਤ ਦੀ ਜਾਂਚ ਹੋ ਗਈ", "खेत की जाँच हो गई")}</li><li>✓ {text("Quantity estimated", "ਮਾਤਰਾ ਦਾ ਅੰਦਾਜ਼ਾ ਲੱਗ ਗਿਆ", "मात्रा का अनुमान हो गया")}</li><li>✓ {text("Documents checked", "ਕਾਗਜ਼ ਜਾਂਚੇ ਗਏ", "दस्तावेज़ जाँचे गए")}</li></ul><p className="mt-3 text-sm font-medium">{text("The weighbridge weight decides the final payable quantity.", "ਅੰਤਿਮ ਭੁਗਤਾਨ ਤੋਲ ਕੰਡੇ ਦੇ ਵਜ਼ਨ ਅਨੁਸਾਰ ਹੋਵੇਗਾ।", "अंतिम भुगतान धर्मकांटे के वजन के अनुसार होगा।")}</p></div></div></section>

      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><div className="flex gap-3"><AlertTriangle className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold uppercase tracking-[0.12em]">{text("Important pickup rule", "ਜ਼ਰੂਰੀ ਚੁੱਕਾਈ ਨਿਯਮ", "जरूरी उठान नियम")}</p><p className="mt-2 text-base font-semibold leading-relaxed">{text("Once confirmed, the pickup date cannot be changed online. If there is a problem, call your operator immediately. If the field is not ready on the confirmed date, a charge of up to ₹15,000 may apply.", "ਤਾਰੀਖ਼ ਪੱਕੀ ਹੋਣ ਤੋਂ ਬਾਅਦ ਇਹ ਆਨਲਾਈਨ ਨਹੀਂ ਬਦਲੀ ਜਾ ਸਕਦੀ। ਕੋਈ ਮੁਸ਼ਕਲ ਹੋਵੇ ਤਾਂ ਤੁਰੰਤ ਓਪਰੇਟਰ ਨੂੰ ਫ਼ੋਨ ਕਰੋ। ਪੱਕੀ ਤਾਰੀਖ਼ ਨੂੰ ਖੇਤ ਤਿਆਰ ਨਾ ਹੋਣ 'ਤੇ ₹15,000 ਤੱਕ ਚਾਰਜ ਲੱਗ ਸਕਦਾ ਹੈ।", "तारीख पक्की होने के बाद इसे ऑनलाइन नहीं बदला जा सकता। समस्या हो तो तुरंत ऑपरेटर को फ़ोन करें। पक्की तारीख पर खेत तैयार न होने पर ₹15,000 तक शुल्क लग सकता है।")}</p></div></div></section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("Pickups and payments", "ਚੁੱਕਾਈਆਂ ਅਤੇ ਭੁਗਤਾਨ", "उठान और भुगतान")}</p><div className="mt-3 space-y-3">{data.batches.length ? data.batches.map((batch) => <div key={batch.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-4"><p className="font-bold">#{batch.id} · {formatNumber(batch.weightTonnes, 2)} {text("tonnes", "ਟਨ", "टन")}</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{statusLabel(batch.status, text)}</span></div><p className="mt-2 text-sm text-muted-foreground">{batch.pickupScheduledAt ? formatDate(batch.pickupScheduledAt) : text("Date being scheduled", "ਤਾਰੀਖ਼ ਤੈਅ ਹੋ ਰਹੀ ਹੈ", "तारीख तय हो रही है")}</p>{batch.status === "paid" || batch.status === "delivered" ? <div className="mt-3 rounded-lg bg-secondary/70 p-3"><p className="text-base font-bold">{formatNumber(batch.weightTonnes, 2)} t × ₹400/t = {formatAmount(batch.farmerPaidInr)}</p><p className="mt-1 text-sm text-muted-foreground">{text("Paid to", "ਭੁਗਤਾਨ ਕੀਤਾ", "भुगतान किया")} {data.farmer.fpoName} · {batch.weighbridgeId}</p><a href={`/r/${batch.id}?lang=${language ?? "pa"}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary underline">{text("View payment receipt", "ਭੁਗਤਾਨ ਦੀ ਰਸੀਦ ਵੇਖੋ", "भुगतान रसीद देखें")}</a></div> : <p className="mt-3 text-sm font-semibold text-primary">{text("Final weight and payment will appear after weighbridge entry.", "ਤੋਲ ਕੰਡੇ ਦੀ ਐਂਟਰੀ ਤੋਂ ਬਾਅਦ ਅੰਤਿਮ ਵਜ਼ਨ ਅਤੇ ਭੁਗਤਾਨ ਦਿਖੇਗਾ।", "धर्मकांटे की एंट्री के बाद अंतिम वजन और भुगतान दिखेगा।")}</p>}</div>) : <p className="py-4 text-lg text-muted-foreground">{text("No collection has been weighed yet.", "ਹਾਲੇ ਕੋਈ ਚੁੱਕਾਈ ਨਹੀਂ ਤੋਲੀ ਗਈ।", "अभी कोई संग्रह तौला नहीं गया है।")}</p>}</div></section>

      <section className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-5"><div className="flex gap-3"><Plus className="mt-1 h-6 w-6 text-primary" /><div><h2 className="text-2xl font-bold">{text("Have more stubble?", "ਹੋਰ ਪਰਾਲੀ ਹੈ?", "और पराली है?")}</h2><p className="mt-1 text-base text-muted-foreground">{text("Enter only the extra tonnes. Your operator will call and verify the field.", "ਸਿਰਫ਼ ਵਾਧੂ ਟਨ ਲਿਖੋ। ਤੁਹਾਡਾ ਓਪਰੇਟਰ ਫ਼ੋਨ ਕਰਕੇ ਖੇਤ ਦੀ ਜਾਂਚ ਕਰੇਗਾ।", "केवल अतिरिक्त टन लिखें। आपका ऑपरेटर फ़ोन करके खेत की जाँच करेगा।")}</p></div></div>{data.pendingCallback ? <div className="mt-4 flex gap-3 rounded-xl bg-card p-4 text-base font-semibold"><CheckCircle2 className="h-6 w-6 shrink-0 text-primary" /><span>{text(`Callback requested for ${formatNumber(data.pendingCallback.additionalTonnes)} extra tonnes.`, `${formatNumber(data.pendingCallback.additionalTonnes)} ਵਾਧੂ ਟਨ ਲਈ ਫ਼ੋਨ ਦੀ ਬੇਨਤੀ ਭੇਜੀ ਗਈ।`, `${formatNumber(data.pendingCallback.additionalTonnes)} अतिरिक्त टन के लिए फ़ोन अनुरोध भेजा गया।`)}</span></div> : <div className="mt-4 flex gap-2"><Input type="number" min="0.1" max="500" step="0.1" inputMode="decimal" value={additionalTonnes} onChange={(event) => setAdditionalTonnes(event.target.value)} placeholder={text("Extra tonnes", "ਵਾਧੂ ਟਨ", "अतिरिक्त टन")} className="h-14 bg-background text-lg" /><Button type="button" className="h-14 px-5 text-base font-bold" disabled={submitting} onClick={() => void requestCallback()}>{submitting ? "…" : text("Request call", "ਫ਼ੋਨ ਮੰਗੋ", "फ़ोन माँगें")}</Button></div>}{requestMessage && <p className="mt-3 text-base font-semibold text-primary" role="status">{requestMessage}</p>}</section>
    </main>
    <footer className="mt-4 border-t border-border bg-background px-5 py-7 text-center"><p className="text-lg font-bold">{text("No app or password needed", "ਕੋਈ ਐਪ ਜਾਂ ਪਾਸਵਰਡ ਨਹੀਂ ਚਾਹੀਦਾ", "कोई ऐप या पासवर्ड नहीं चाहिए")}</p><p className="mt-1 text-sm text-muted-foreground">{data.farmer.fpoName}</p></footer>
  </div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-secondary/70 px-3 py-3"><p className="min-h-10 text-xs font-semibold leading-tight text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function statusLabel(status: BatchStatus, text: (en: string, pa: string, hi: string) => string) {
  if (status === "registered") return text("Registered", "ਦਰਜ", "पंजीकृत");
  if (status === "baled") return text("Baled and weighed", "ਗੱਠਾਂ ਬਣੀਆਂ ਅਤੇ ਤੋਲਿਆ", "गट्ठे बने और तौला गया");
  if (status === "paid") return text("Paid", "ਭੁਗਤਾਨ ਹੋਇਆ", "भुगतान हुआ");
  return text("Delivered", "ਪਹੁੰਚਾਇਆ", "पहुंचाया गया");
}

function nextStepLabel(status: BatchStatus, text: (en: string, pa: string, hi: string) => string) {
  if (status === "registered") return text("Next: field pickup", "ਅਗਲਾ: ਖੇਤ ਤੋਂ ਚੁੱਕਾਈ", "अगला: खेत से उठान");
  if (status === "baled") return text("Next: payment", "ਅਗਲਾ: ਭੁਗਤਾਨ", "अगला: भुगतान");
  if (status === "paid") return text("Next: buyer delivery", "ਅਗਲਾ: ਖਰੀਦਦਾਰ ਤੱਕ ਪਹੁੰਚ", "अगला: खरीदार तक पहुँच");
  return text("Collection complete", "ਚੁੱਕਾਈ ਪੂਰੀ ਹੋਈ", "संग्रह पूरा हुआ");
}
