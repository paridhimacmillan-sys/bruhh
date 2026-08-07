import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, IndianRupee, Leaf, Phone, Plus, Scale, Truck } from "lucide-react";
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

const previewData: FarmerDashboard = {
  farmer: { name: "Gurpreet Singh", fpoName: "Sunam Kisan Producer Company", listedTonnes: 20, clusterName: "Sunam North", district: "Sangrur" },
  operator: { name: "Jagmeet Singh", phone: "9876500003" },
  batches: [{ id: 431, status: "delivered", weightTonnes: 4.2, farmerPaidInr: 1680, pickupScheduledAt: "2025-10-18T08:30:00.000Z", baledAt: "2025-10-18T08:30:00.000Z", weighbridgeId: "WB-SUN-114" }],
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
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
  const currentBatch = useMemo(() => data?.batches.find((batch) => statusOrder[batch.status] < 3) ?? data?.batches[0] ?? null, [data]);

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
  if (notFound || !data) return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center"><div><p className="font-display text-2xl">Unpack<span className="text-primary">OS</span></p><h1 className="mt-7 text-3xl font-bold">{text("Farmer dashboard not found", "ਕਿਸਾਨ ਡੈਸ਼ਬੋਰਡ ਨਹੀਂ ਮਿਲਿਆ", "किसान डैशबोर्ड नहीं मिला")}</h1><p className="mt-3 text-lg text-muted-foreground">{text("Check the private SMS link and try again.", "ਨਿੱਜੀ SMS ਲਿੰਕ ਜਾਂਚ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "निजी SMS लिंक जाँचकर फिर कोशिश करें।")}</p><LanguageToggle className="mt-6" /></div></main>;

  return <div className="min-h-screen bg-secondary/35 text-foreground">
    <header className="border-b border-border bg-background"><div className="mx-auto flex min-h-16 max-w-lg items-center justify-between px-5"><p className="font-display text-2xl">Unpack<span className="text-primary">OS</span></p><LanguageToggle /></div></header>
    <main className="mx-auto max-w-lg px-4 py-6 sm:px-5">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{text("Farmer dashboard", "ਕਿਸਾਨ ਡੈਸ਼ਬੋਰਡ", "किसान डैशबोर्ड")}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight">{text("Sat Sri Akal", "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ", "नमस्ते")}, {data.farmer.name}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{data.farmer.clusterName}, {data.farmer.district}</p>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Stat icon={Leaf} label={text("Accepted quantity", "ਮਨਜ਼ੂਰ ਮਾਤਰਾ", "स्वीकृत मात्रा")} value={`${formatNumber(data.farmer.listedTonnes)} t`} />
        <Stat icon={Scale} label={text("Collected", "ਚੁੱਕੀ ਗਈ", "एकत्रित")} value={`${formatNumber(data.totalCollectedTonnes)} t`} />
        <div className="col-span-2"><Stat icon={IndianRupee} label={text("Paid to your FPO account", "ਤੁਹਾਡੇ FPO ਖਾਤੇ ਵਿੱਚ ਭੁਗਤਾਨ", "आपके FPO खाते में भुगतान")} value={formatAmount(data.totalPaidInr)} wide /></div>
      </section>

      <section className="mt-4 rounded-2xl border-2 border-foreground bg-card p-5">
        <div className="flex items-start gap-3"><CalendarDays className="mt-1 h-6 w-6 text-primary" /><div><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("Pickup", "ਚੁੱਕਾਈ", "पिकअप")}</p><p className="mt-1 text-2xl font-bold">{currentBatch?.pickupScheduledAt ? formatDate(currentBatch.pickupScheduledAt) : text("Being scheduled", "ਤਾਰੀਖ਼ ਤੈਅ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ", "तारीख तय की जा रही है")}</p></div></div>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-3 text-base font-semibold"><Truck className="h-5 w-5 text-primary" />{currentBatch ? statusLabel(currentBatch.status, text) : text("Registration accepted", "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਮਨਜ਼ੂਰ", "पंजीकरण स्वीकृत")}</div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="farmer-progress-title">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("Your progress", "ਤੁਹਾਡੀ ਪ੍ਰਗਤੀ", "आपकी प्रगति")}</p><h2 id="farmer-progress-title" className="mt-1 text-2xl font-bold">{nextStepLabel(currentBatch?.status ?? "registered", text)}</h2></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{Math.min(4, statusOrder[currentBatch?.status ?? "registered"] + 1)}/4</span></div>
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

      {data.operator && <section className="mt-4 rounded-2xl border border-border bg-card p-5"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("Your field operator", "ਤੁਹਾਡਾ ਫ਼ੀਲਡ ਓਪਰੇਟਰ", "आपका फील्ड ऑपरेटर")}</p><p className="mt-2 text-2xl font-bold">{data.operator.name}</p><a href={`tel:+91${data.operator.phone}`} className="mt-4 flex min-h-14 items-center justify-center gap-3 rounded-xl bg-primary px-4 text-lg font-bold text-primary-foreground"><Phone className="h-6 w-6" />{text("Call operator", "ਓਪਰੇਟਰ ਨੂੰ ਫ਼ੋਨ ਕਰੋ", "ऑपरेटर को फ़ोन करें")}</a></section>}

      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><p className="text-sm font-semibold uppercase tracking-[0.12em]">{text("Important pickup information", "ਜ਼ਰੂਰੀ ਚੁੱਕਾਈ ਜਾਣਕਾਰੀ", "जरूरी उठान जानकारी")}</p><ul className="mt-3 space-y-2 text-base leading-relaxed"><li>• {text("Keep the field access clear on pickup day.", "ਚੁੱਕਾਈ ਵਾਲੇ ਦਿਨ ਖੇਤ ਦਾ ਰਸਤਾ ਖੁੱਲ੍ਹਾ ਰੱਖੋ।", "उठान वाले दिन खेत का रास्ता साफ रखें।")}</li><li>• {text("Call your operator if the quantity changes.", "ਮਾਤਰਾ ਬਦਲੇ ਤਾਂ ਆਪਣੇ ਓਪਰੇਟਰ ਨੂੰ ਫੋਨ ਕਰੋ।", "मात्रा बदले तो अपने ऑपरेटर को फोन करें।")}</li><li>• {text("Final payment uses the weighbridge weight.", "ਅੰਤਿਮ ਭੁਗਤਾਨ ਤੋਲ ਕੰਡੇ ਦੇ ਵਜ਼ਨ ਅਨੁਸਾਰ ਹੁੰਦਾ ਹੈ।", "अंतिम भुगतान धर्मकांटे के वजन पर होता है।")}</li></ul></section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{text("Your collections", "ਤੁਹਾਡੀਆਂ ਚੁੱਕਾਈਆਂ", "आपके संग्रह")}</p><div className="mt-3 space-y-3">{data.batches.length ? data.batches.map((batch) => <div key={batch.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-4"><p className="font-bold">#{batch.id} · {formatNumber(batch.weightTonnes, 2)} t</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{statusLabel(batch.status, text)}</span></div><div className="mt-3 flex justify-between text-sm text-muted-foreground"><span>{batch.weighbridgeId}</span><span className="font-semibold text-foreground">{formatAmount(batch.farmerPaidInr)}</span></div>{batch.status === "paid" || batch.status === "delivered" ? <a href={`/r/${batch.id}?lang=${language ?? "pa"}`} className="mt-3 inline-flex text-sm font-bold text-primary underline">{text("Open receipt", "ਰਸੀਦ ਖੋਲ੍ਹੋ", "रसीद खोलें")}</a> : null}</div>) : <p className="py-4 text-lg text-muted-foreground">{text("No collection has been weighed yet.", "ਹਾਲੇ ਕੋਈ ਚੁੱਕਾਈ ਨਹੀਂ ਤੋਲੀ ਗਈ।", "अभी कोई संग्रह तौला नहीं गया है।")}</p>}</div></section>

      <section className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-5"><div className="flex gap-3"><Plus className="mt-1 h-6 w-6 text-primary" /><div><h2 className="text-2xl font-bold">{text("Have more stubble?", "ਹੋਰ ਪਰਾਲੀ ਹੈ?", "और पराली है?")}</h2><p className="mt-1 text-base text-muted-foreground">{text("Enter only the extra tonnes. Your operator will call and verify the field.", "ਸਿਰਫ਼ ਵਾਧੂ ਟਨ ਲਿਖੋ। ਤੁਹਾਡਾ ਓਪਰੇਟਰ ਫ਼ੋਨ ਕਰਕੇ ਖੇਤ ਦੀ ਜਾਂਚ ਕਰੇਗਾ।", "केवल अतिरिक्त टन लिखें। आपका ऑपरेटर फ़ोन करके खेत की जाँच करेगा।")}</p></div></div>{data.pendingCallback ? <div className="mt-4 flex gap-3 rounded-xl bg-card p-4 text-base font-semibold"><CheckCircle2 className="h-6 w-6 shrink-0 text-primary" /><span>{text(`Callback requested for ${formatNumber(data.pendingCallback.additionalTonnes)} extra tonnes.`, `${formatNumber(data.pendingCallback.additionalTonnes)} ਵਾਧੂ ਟਨ ਲਈ ਫ਼ੋਨ ਦੀ ਬੇਨਤੀ ਭੇਜੀ ਗਈ।`, `${formatNumber(data.pendingCallback.additionalTonnes)} अतिरिक्त टन के लिए फ़ोन अनुरोध भेजा गया।`)}</span></div> : <div className="mt-4 flex gap-2"><Input type="number" min="0.1" max="500" step="0.1" inputMode="decimal" value={additionalTonnes} onChange={(event) => setAdditionalTonnes(event.target.value)} placeholder={text("Extra tonnes", "ਵਾਧੂ ਟਨ", "अतिरिक्त टन")} className="h-14 bg-background text-lg" /><Button type="button" className="h-14 px-5 text-base font-bold" disabled={submitting} onClick={() => void requestCallback()}>{submitting ? "…" : text("Request call", "ਫ਼ੋਨ ਮੰਗੋ", "फ़ोन माँगें")}</Button></div>}{requestMessage && <p className="mt-3 text-base font-semibold text-primary" role="status">{requestMessage}</p>}</section>
    </main>
    <footer className="mt-4 border-t border-border bg-background px-5 py-7 text-center"><p className="text-lg font-bold">{text("No app or password needed", "ਕੋਈ ਐਪ ਜਾਂ ਪਾਸਵਰਡ ਨਹੀਂ ਚਾਹੀਦਾ", "कोई ऐप या पासवर्ड नहीं चाहिए")}</p><p className="mt-1 text-sm text-muted-foreground">{data.farmer.fpoName}</p></footer>
  </div>;
}

function Stat({ icon: Icon, label, value, wide = false }: { icon: typeof Leaf; label: string; value: string; wide?: boolean }) {
  return <div className={`h-full rounded-2xl border border-border bg-card p-4 ${wide ? "flex items-center justify-between gap-4" : ""}`}><div><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-semibold text-muted-foreground">{label}</p></div><p className={`${wide ? "text-right" : "mt-1"} text-3xl font-bold`}>{value}</p></div>;
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
