import { FormEvent, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListLotsQueryKey,
  getGetLotQueryKey,
  useCreateCommitmentRequest,
  useCreateOrder,
  useGetLot,
  useListLots,
  type IndustryType,
  type Lot,
} from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, ArrowUpRight, CheckCircle2, IndianRupee, MapPin, Search, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LanguageToggle, useLanguage } from "@/lib/language";

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function PickupPolicyNotice() {
  const { text } = useLanguage();

  return (
    <div className="flex gap-3 rounded-md border border-straw bg-straw/35 p-3 text-xs leading-relaxed text-straw-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{text("Pickup date policy: ", "ਚੁੱਕਾਈ ਦੀ ਤਾਰੀਖ਼ ਦੀ ਨੀਤੀ: ", "पिकअप तारीख नीति: ")}</span>
        {text(
          "Once confirmed, the pickup date cannot be changed. Failure to collect on the agreed date may incur a ₹15,000 penalty.",
          "ਪੁਸ਼ਟੀ ਹੋਣ ਤੋਂ ਬਾਅਦ ਚੁੱਕਾਈ ਦੀ ਤਾਰੀਖ਼ ਬਦਲੀ ਨਹੀਂ ਜਾ ਸਕਦੀ। ਤੈਅ ਤਾਰੀਖ਼ 'ਤੇ ਮਾਲ ਨਾ ਚੁੱਕਣ 'ਤੇ ₹15,000 ਜੁਰਮਾਨਾ ਲੱਗ ਸਕਦਾ ਹੈ।",
          "पुष्टि होने के बाद पिकअप की तारीख बदली नहीं जा सकती। तय तारीख पर माल न उठाने पर ₹15,000 का जुर्माना लग सकता है।",
        )}
      </p>
    </div>
  );
}

function LotCard({ lot, onRequest }: { lot: Lot; onRequest: (lot: Lot) => void }) {
  const { text } = useLanguage();
  const canRequest = lot.status === "available" || lot.status === "requested";
  const statusLabel = lot.status === "available" ? text("Available", "ਉਪਲਬਧ", "उपलब्ध") : lot.status === "requested" ? text("Requested", "ਬੇਨਤੀ ਹੋਈ", "अनुरोधित") : lot.status === "committed" ? text("Committed", "ਵਚਨਬੱਧ", "प्रतिबद्ध") : text("Sold", "ਵਿਕਿਆ", "बिका");
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
      {lot.label && <div className="bg-straw px-5 py-2 text-xs font-medium text-straw-foreground">{text(lot.label, "ਸਟੋਰ ਕੀਤਾ · ਫ਼ਰਵਰੀ ਡਿਲਿਵਰੀ", "भंडारित · फ़रवरी डिलीवरी")}</div>}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-medium text-primary">{lot.id}</p>
            <h3 className="mt-2 font-display text-2xl">{lot.clusterName}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{lot.clusterDistrict} {text("district", "ਜ਼ਿਲ੍ਹਾ", "ज़िला")}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-medium ${lot.status === "available" ? "border-primary/20 bg-primary/10 text-primary" : "border-straw bg-straw/45 text-straw-foreground"}`}>{statusLabel}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-y border-border py-5">
          <div><p className="text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">{text("Volume", "ਮਾਤਰਾ", "मात्रा")}</p><p className="mt-1 font-display text-3xl">{lot.tonnes} t</p></div>
          <div><p className="text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">{text("Ex-yard", "ਯਾਰਡ ਮੁੱਲ", "यार्ड मूल्य")}</p><p className="mt-1 font-display text-3xl">{formatInr(lot.priceInrPerTonne)}<span className="text-sm">/t</span></p></div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4"><dt className="flex items-center gap-2 text-muted-foreground"><Warehouse className="mt-0.5 h-4 w-4" /> {text("Yard", "ਯਾਰਡ", "यार्ड")}</dt><dd className="max-w-[60%] text-right">{lot.yardName}</dd></div>
          <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">{text("Baled", "ਗੱਠਾਂ ਬਣੀਆਂ", "गांठें बनीं")}</dt><dd>{formatDate(lot.baledAt)}</dd></div>
        </dl>

        <div className="mt-5 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5"><span className="text-xs text-muted-foreground">{text("Estimated lot value", "ਲਾਟ ਦੀ ਅਨੁਮਾਨਿਤ ਕੀਮਤ", "लॉट का अनुमानित मूल्य")}</span><span className="text-sm font-semibold">{formatInr(lot.tonnes * lot.priceInrPerTonne)}</span></div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <Link href={`/market/${lot.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary">{text("View lot details", "ਲਾਟ ਦੀ ਜਾਣਕਾਰੀ ਵੇਖੋ", "लॉट का विवरण देखें")} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          <Button size="sm" disabled={!canRequest} onClick={() => onRequest(lot)}>{text("Request to buy", "ਖਰੀਦ ਬੇਨਤੀ", "खरीद अनुरोध")}</Button>
        </div>
      </div>
    </article>
  );
}

function BuyDialog({ lot, open, onOpenChange }: { lot: Lot | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { text } = useLanguage();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const mutation = useCreateOrder({ mutation: { onSuccess: async () => { setSuccess(true); await queryClient.invalidateQueries({ queryKey: getListLotsQueryKey() }); } } });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lot) return;
    setError("");
    const data = new FormData(event.currentTarget);
    mutation.mutate({ data: { lotId: lot.id, company: String(data.get("company")), phone: String(data.get("phone")), tonnes: Number(data.get("tonnes")) } }, { onError: (failure) => setError((failure as { data?: { message?: string } }).data?.message ?? "We could not place this request.") });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setSuccess(false); setError(""); } }}>
      <DialogContent className="max-w-md">
        {success ? <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-primary" /><DialogTitle className="mt-4 font-display text-3xl">{text("Request received", "ਬੇਨਤੀ ਮਿਲ ਗਈ", "अनुरोध मिल गया")}</DialogTitle><p className="mt-2 text-sm text-muted-foreground">{text("Dispatch will confirm availability and call you.", "ਡਿਸਪੈਚ ਟੀਮ ਉਪਲਬਧਤਾ ਦੀ ਪੁਸ਼ਟੀ ਕਰਕੇ ਤੁਹਾਨੂੰ ਫ਼ੋਨ ਕਰੇਗੀ।", "डिस्पैच टीम उपलब्धता की पुष्टि करके आपको फ़ोन करेगी।")}</p><Button className="mt-6" onClick={() => onOpenChange(false)}>{text("Done", "ਠੀਕ ਹੈ", "ठीक है")}</Button></div> : <>
          <DialogHeader><DialogTitle className="font-display text-3xl">{text("Request", "ਬੇਨਤੀ", "अनुरोध")} {lot?.id}</DialogTitle><DialogDescription>{text(`Partial-lot requests are welcome. Up to ${lot?.tonnes} tonnes listed.`, `ਲਾਟ ਦਾ ਕੁਝ ਹਿੱਸਾ ਵੀ ਮੰਗ ਸਕਦੇ ਹੋ। ${lot?.tonnes} ਟਨ ਤੱਕ ਉਪਲਬਧ ਹੈ।`, `लॉट का कुछ हिस्सा भी मांग सकते हैं। ${lot?.tonnes} टन तक उपलब्ध है।`)}</DialogDescription></DialogHeader>
          <form className="mt-3 space-y-4" onSubmit={submit}>
            <PickupPolicyNotice />
            <label className="block text-xs font-medium">{text("Company", "ਕੰਪਨੀ", "कंपनी")}<Input name="company" className="mt-1.5" required minLength={2} /></label>
            <label className="block text-xs font-medium">{text("Phone", "ਫ਼ੋਨ", "फ़ोन")}<Input name="phone" className="mt-1.5" required inputMode="tel" placeholder="+91 98765 43210" /></label>
            <label className="block text-xs font-medium">{text("Tonnes wanted", "ਲੋੜੀਂਦੇ ਟਨ", "आवश्यक टन")}<Input name="tonnes" className="mt-1.5" required type="number" min="0.1" max={lot?.tonnes} step="0.1" /></label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? text("Sending…", "ਭੇਜ ਰਹੇ ਹਾਂ…", "भेज रहे हैं…") : text("Send purchase request", "ਖਰੀਦ ਬੇਨਤੀ ਭੇਜੋ", "खरीद अनुरोध भेजें")}</Button>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  );
}

function CommitmentForm() {
  const { text } = useLanguage();
  const [success, setSuccess] = useState(false);
  const mutation = useCreateCommitmentRequest({ mutation: { onSuccess: () => setSuccess(true) } });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutation.mutate({ data: { companyName: String(data.get("companyName")), industryType: String(data.get("industryType")) as IndustryType, volumeTonnes: Number(data.get("volumeTonnes")), preferredWindow: String(data.get("preferredWindow")), phone: String(data.get("phone")) } });
  }
  if (success) return <div className="rounded-lg border border-primary/20 bg-primary/10 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-primary" /><h3 className="mt-4 font-display text-3xl">{text("Commitment received", "ਵਚਨਬੱਧਤਾ ਬੇਨਤੀ ਮਿਲ ਗਈ", "प्रतिबद्धता अनुरोध मिल गया")}</h3><p className="mt-2 text-sm text-muted-foreground">{text("Our Sangrur team will contact you to shape the volume plan.", "ਸਾਡੀ ਸੰਗਰੂਰ ਟੀਮ ਮਾਤਰਾ ਯੋਜਨਾ ਲਈ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੇਗੀ।", "हमारी संगरूर टीम मात्रा योजना के लिए आपसे संपर्क करेगी।")}</p></div>;
  return <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 sm:p-8"><p className="eyebrow">{text("Request a commitment", "ਵਚਨਬੱਧਤਾ ਬੇਨਤੀ", "प्रतिबद्धता अनुरोध")}</p><div className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="text-xs font-medium sm:col-span-2">{text("Company name", "ਕੰਪਨੀ ਦਾ ਨਾਮ", "कंपनी का नाम")}<Input name="companyName" className="mt-1.5" required /></label>
    <label className="text-xs font-medium">{text("Industry type", "ਉਦਯੋਗ ਕਿਸਮ", "उद्योग प्रकार")}<select name="industryType" className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required><option value="CBG">CBG</option><option value="pellet">Pellet</option><option value="boiler">Boiler</option><option value="board">Board</option><option value="other">{text("Other", "ਹੋਰ", "अन्य")}</option></select></label>
    <label className="text-xs font-medium">{text("Volume needed (tonnes)", "ਲੋੜੀਂਦੀ ਮਾਤਰਾ (ਟਨ)", "आवश्यक मात्रा (टन)")}<Input name="volumeTonnes" className="mt-1.5" type="number" min="1" required /></label>
    <label className="text-xs font-medium">{text("Preferred window", "ਪਸੰਦੀਦਾ ਸਮਾਂ", "पसंदीदा समय")}<Input name="preferredWindow" className="mt-1.5" placeholder="Oct–Nov 2026" required /></label>
    <label className="text-xs font-medium">{text("Contact phone", "ਸੰਪਰਕ ਫ਼ੋਨ", "संपर्क फ़ोन")}<Input name="phone" className="mt-1.5" inputMode="tel" required /></label>
  </div><Button className="mt-5 w-full" disabled={mutation.isPending}>{mutation.isPending ? text("Sending…", "ਭੇਜ ਰਹੇ ਹਾਂ…", "भेज रहे हैं…") : text("Request commitment", "ਵਚਨਬੱਧਤਾ ਮੰਗੋ", "प्रतिबद्धता मांगें")}</Button></form>;
}

function MarketHeader() {
  const { text } = useLanguage();
  return <header className="border-b border-border/70 bg-background"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8"><Link href="/" className="font-display text-lg">Unpack<span className="text-primary">OS</span></Link><div className="flex items-center gap-3 sm:gap-4"><Link href="/" className="hidden text-sm text-muted-foreground sm:inline">{text("About", "ਸਾਡੇ ਬਾਰੇ", "हमारे बारे में")}</Link><Link href="/market" className="text-sm font-medium text-primary">{text("Market", "ਮੰਡੀ", "बाज़ार")}</Link><LanguageToggle /></div></div></header>;
}

export function MarketPage() {
  const { text } = useLanguage();
  const [tab, setTab] = useState<"lots" | "commitments">("lots");
  const [selected, setSelected] = useState<Lot | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "available" | "requested">("all");
  const [sort, setSort] = useState<"latest" | "volume" | "price">("latest");
  const { data: rawLots = [], isLoading } = useListLots({ query: { queryKey: getListLotsQueryKey(), retry: false } });
  const availableTonnes = rawLots.filter((lot) => lot.status === "available" || lot.status === "requested").reduce((sum, lot) => sum + lot.tonnes, 0);
  const yardCount = new Set(rawLots.map((lot) => lot.yardName)).size;
  const liveLots = rawLots.filter((lot) => lot.status === "available" || lot.status === "requested").length;
  const lots = useMemo(() => rawLots.filter((lot) => {
    const matchesSearch = `${lot.id} ${lot.clusterName} ${lot.clusterDistrict} ${lot.yardName}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === "all" || lot.status === status);
  }).sort((a, b) => sort === "volume" ? b.tonnes - a.tonnes : sort === "price" ? a.priceInrPerTonne - b.priceInrPerTonne : new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime()), [rawLots, search, sort, status]);
  return <div className="min-h-screen bg-background"><MarketHeader /><main>
    <section className="border-b border-border bg-primary text-primary-foreground"><div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16"><p className="text-[0.65rem] uppercase tracking-[0.18em] opacity-70">{text("UnpackOS live market", "UnpackOS ਲਾਈਵ ਮੰਡੀ", "UnpackOS लाइव बाज़ार")}</p><div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end"><div><h1 className="max-w-3xl font-display text-4xl tracking-tight sm:text-6xl">{text("Verified residue, ready to move.", "ਤਸਦੀਕਸ਼ੁਦਾ ਪਰਾਲੀ, ਚੁੱਕਣ ਲਈ ਤਿਆਰ।", "सत्यापित पराली, उठाने के लिए तैयार।")}</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-80">{text("Browse paddy-residue lots with clear volume, pricing and pickup terms.", "ਸਾਫ਼ ਮਾਤਰਾ, ਕੀਮਤ ਅਤੇ ਚੁੱਕਾਈ ਦੀਆਂ ਸ਼ਰਤਾਂ ਵਾਲੇ ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਦੇ ਲਾਟ ਵੇਖੋ।", "स्पष्ट मात्रा, मूल्य और उठान शर्तों वाले धान-पराली लॉट देखें।")}</p></div><div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-primary-foreground/20 bg-primary-foreground/20"><div className="bg-primary p-4"><p className="text-[0.65rem] opacity-70">{text("Tonnes", "ਟਨ", "टन")}</p><p className="mt-2 font-display text-2xl">{availableTonnes.toFixed(0)}</p></div><div className="bg-primary p-4"><p className="text-[0.65rem] opacity-70">{text("Live lots", "ਲਾਈਵ ਲਾਟ", "लाइव लॉट")}</p><p className="mt-2 font-display text-2xl">{liveLots}</p></div><div className="bg-primary p-4"><p className="text-[0.65rem] opacity-70">{text("Yards", "ਯਾਰਡ", "यार्ड")}</p><p className="mt-2 font-display text-2xl">{yardCount}</p></div></div></div></div></section>
    <section className="border-b border-border bg-card"><div className="mx-auto grid max-w-7xl gap-3 px-5 py-4 text-xs md:grid-cols-3 md:px-8"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><span>{text("Verified cluster and weighbridge records", "ਤਸਦੀਕਸ਼ੁਦਾ ਕਲੱਸਟਰ ਅਤੇ ਤੋਲ ਕੰਡਾ ਰਿਕਾਰਡ", "सत्यापित क्लस्टर और धर्मकांटा रिकॉर्ड")}</span></div><div className="flex items-center gap-2"><IndianRupee className="h-4 w-4 text-primary" /><span>{text("Transparent ex-yard price per tonne", "ਪ੍ਰਤੀ ਟਨ ਸਾਫ਼ ਯਾਰਡ ਕੀਮਤ", "प्रति टन स्पष्ट एक्स-यार्ड मूल्य")}</span></div><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><span>{text("Partial-lot requests supported", "ਲਾਟ ਦੇ ਹਿੱਸੇ ਲਈ ਬੇਨਤੀ ਉਪਲਬਧ", "आंशिक लॉट अनुरोध उपलब्ध")}</span></div></div></section>
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12"><div className="inline-flex rounded-lg border border-border bg-secondary p-1" role="tablist"><button className={`rounded-md px-4 py-2 text-sm ${tab === "lots" ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("lots")}>{text("Available lots", "ਉਪਲਬਧ ਲਾਟ", "उपलब्ध लॉट")}</button><button className={`rounded-md px-4 py-2 text-sm ${tab === "commitments" ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("commitments")}>{text("Pre-season commitments", "ਸੀਜ਼ਨ ਤੋਂ ਪਹਿਲਾਂ ਵਚਨਬੱਧਤਾ", "सीज़न-पूर्व प्रतिबद्धताएँ")}</button></div>
      <div className="mt-5 max-w-2xl"><PickupPolicyNotice /></div>
      {tab === "lots" && <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_auto_auto]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Search cluster, yard or lot ID", "ਕਲੱਸਟਰ, ਯਾਰਡ ਜਾਂ ਲਾਟ ID ਲੱਭੋ", "क्लस्टर, यार्ड या लॉट ID खोजें")} className="pl-9" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">{text("All live stock", "ਸਾਰਾ ਲਾਈਵ ਸਟਾਕ", "सभी लाइव स्टॉक")}</option><option value="available">{text("Available", "ਉਪਲਬਧ", "उपलब्ध")}</option><option value="requested">{text("Requested", "ਬੇਨਤੀ ਹੋਈ", "अनुरोधित")}</option></select><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="latest">{text("Newest first", "ਨਵਾਂ ਪਹਿਲਾਂ", "नया पहले")}</option><option value="volume">{text("Highest volume", "ਵੱਧ ਮਾਤਰਾ", "अधिक मात्रा")}</option><option value="price">{text("Lowest price", "ਘੱਟ ਕੀਮਤ", "कम मूल्य")}</option></select></div>}
      {tab === "lots" && !isLoading && <p className="mt-3 text-xs text-muted-foreground">{text(`${lots.length} lots match your selection`, `${lots.length} ਲਾਟ ਤੁਹਾਡੀ ਚੋਣ ਨਾਲ ਮਿਲਦੇ ਹਨ`, `${lots.length} लॉट आपके चयन से मेल खाते हैं`)}</p>}
      {tab === "lots" ? <section className="mt-8"><div className="flex items-end justify-between"><div><p className="eyebrow">{text("In-season stock", "ਸੀਜ਼ਨ ਦਾ ਸਟਾਕ", "सीज़न का स्टॉक")}</p><h2 className="mt-2 font-display text-3xl">{text("Sangrur yard lots", "ਸੰਗਰੂਰ ਯਾਰਡ ਲਾਟ", "संगरूर यार्ड लॉट")}</h2></div><p className="hidden text-xs text-muted-foreground sm:block">{text("Ex-yard · buyer arranges pickup", "ਯਾਰਡ ਮੁੱਲ · ਚੁੱਕਾਈ ਖਰੀਦਦਾਰ ਕਰੇਗਾ", "यार्ड मूल्य · उठान खरीदार करेगा")}</p></div>{isLoading ? <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><div className="h-96 animate-pulse rounded-lg bg-secondary" /></div> : <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{lots.map((lot) => <LotCard key={lot.id} lot={lot} onRequest={setSelected} />)}</div>}</section> : <section className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="eyebrow">{text("Pre-season supply", "ਸੀਜ਼ਨ ਤੋਂ ਪਹਿਲਾਂ ਸਪਲਾਈ", "सीज़न-पूर्व आपूर्ति")}</p><h2 className="mt-3 font-display text-4xl">{text("Lock volume before the harvest rush.", "ਵਾਢੀ ਦੀ ਭੀੜ ਤੋਂ ਪਹਿਲਾਂ ਮਾਤਰਾ ਪੱਕੀ ਕਰੋ।", "कटाई की भागदौड़ से पहले मात्रा तय करें।")}</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{text("A commitment lets UnpackOS schedule clusters, balers and short-haul transport against a known industrial need.", "ਵਚਨਬੱਧਤਾ ਨਾਲ UnpackOS ਜਾਣੀ ਉਦਯੋਗਿਕ ਲੋੜ ਮੁਤਾਬਕ ਕਲੱਸਟਰ, ਬੇਲਰ ਅਤੇ ਨੇੜਲੀ ਆਵਾਜਾਈ ਤੈਅ ਕਰਦਾ ਹੈ।", "प्रतिबद्धता से UnpackOS ज्ञात औद्योगिक जरूरत के अनुसार क्लस्टर, बेलर और स्थानीय परिवहन तय करता है।")}</p><ol className="mt-8 space-y-5">{[["01",text("Lock volume + price","ਮਾਤਰਾ + ਮੁੱਲ ਪੱਕਾ ਕਰੋ","मात्रा + मूल्य तय करें"),text("Agree the tonnage, delivery window and transparent per-tonne rate.","ਟਨ, ਡਿਲਿਵਰੀ ਸਮਾਂ ਅਤੇ ਸਾਫ਼ ਪ੍ਰਤੀ-ਟਨ ਦਰ ਤੈਅ ਕਰੋ।","टन, डिलीवरी समय और स्पष्ट प्रति-टन दर तय करें।")],["02",text("40% mobilization advance","40% ਮੋਬਿਲਾਈਜ਼ੇਸ਼ਨ ਅਗਾਊਂ","40% मोबिलाइज़ेशन अग्रिम"),text("Funds activate equipment, field coordination and weighbridge payouts.","ਰਕਮ ਸਾਜ਼ੋ-ਸਾਮਾਨ, ਖੇਤ ਤਾਲਮੇਲ ਅਤੇ ਵੇਅਬ੍ਰਿਜ ਭੁਗਤਾਨ ਚਾਲੂ ਕਰਦੀ ਹੈ।","राशि उपकरण, खेत समन्वय और वेब्रिज भुगतान सक्रिय करती है।")],["03",text("Protected until 60% delivery","60% ਡਿਲਿਵਰੀ ਤੱਕ ਸੁਰੱਖਿਅਤ","60% डिलीवरी तक सुरक्षित"),text("The committed rate and volume stay reserved while deliveries ramp.","ਡਿਲਿਵਰੀ ਵਧਣ ਦੌਰਾਨ ਤੈਅ ਦਰ ਅਤੇ ਮਾਤਰਾ ਰਾਖਵੀਂ ਰਹਿੰਦੀ ਹੈ।","डिलीवरी बढ़ने तक तय दर और मात्रा आरक्षित रहती है।")]].map(([n,t,d]) => <li key={n} className="flex gap-4 border-t border-border pt-4"><span className="font-display text-sm text-primary">{n}</span><div><p className="font-medium">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p></div></li>)}</ol></div><CommitmentForm /></section>}
    </div>
  </main><BuyDialog lot={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} /></div>;
}

export function LotDetailPage() {
  const { text } = useLanguage();
  const { lotId = "" } = useParams<{ lotId: string }>();
  const { data: lot, isLoading } = useGetLot(lotId, { query: { queryKey: getGetLotQueryKey(lotId), retry: false } });
  if (isLoading) return <div className="min-h-screen animate-pulse bg-secondary" />;
  if (!lot) return <main className="flex min-h-screen items-center justify-center"><div className="text-center"><h1 className="font-display text-4xl">{text("Lot not found", "ਲਾਟ ਨਹੀਂ ਮਿਲਿਆ", "लॉट नहीं मिला")}</h1><Link href="/market" className="mt-4 inline-block text-sm text-primary">{text("Back to market", "ਮੰਡੀ ਵਾਪਸ", "बाज़ार वापस")}</Link></div></main>;
  return (
    <div className="min-h-screen bg-background">
      <MarketHeader />
      <main className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-14">
        <Link href="/market" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> {text("All lots", "ਸਾਰੇ ਲਾਟ", "सभी लॉट")}</Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <p className="font-mono text-xs text-primary">{lot.id}</p>
            <h1 className="mt-3 font-display text-5xl">{lot.clusterName} {text("lot", "ਲਾਟ", "लॉट")}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {lot.yardName}, {lot.yardDistrict}</p>
            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <div className="bg-card p-5"><p className="text-xs text-muted-foreground">{text("Available volume", "ਉਪਲਬਧ ਮਾਤਰਾ", "उपलब्ध मात्रा")}</p><p className="mt-2 font-display text-3xl">{lot.tonnes} t</p></div>
              <div className="bg-card p-5"><p className="text-xs text-muted-foreground">{text("Ex-yard price", "ਯਾਰਡ ਮੁੱਲ", "यार्ड मूल्य")}</p><p className="mt-2 font-display text-3xl">{formatInr(lot.priceInrPerTonne)}/t</p></div>
              <div className="bg-card p-5"><p className="text-xs text-muted-foreground">{text("Source batches", "ਸਰੋਤ ਬੈਚ", "स्रोत बैच")}</p><p className="mt-2 font-display text-3xl">{lot.passportIds.length}</p></div>
              <div className="bg-card p-5"><p className="text-xs text-muted-foreground">{text("Baled", "ਗੱਠਾਂ ਬਣੀਆਂ", "गांठें बनीं")}</p><p className="mt-2 text-sm font-medium">{formatDate(lot.baledAt)}</p></div>
            </div>
            <div className="mt-6 rounded-lg border border-primary/20 bg-primary/10 p-5">
              <p className="font-medium">{text("Backed by field, weighbridge and delivery records.", "ਖੇਤ, ਵੇਅਬ੍ਰਿਜ ਅਤੇ ਡਿਲਿਵਰੀ ਰਿਕਾਰਡ ਨਾਲ ਤਸਦੀਕਸ਼ੁਦਾ।", "खेत, वेब्रिज और डिलीवरी रिकॉर्ड से सत्यापित।")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text(`${lot.passportIds.length} source batches are linked to this lot.`, `${lot.passportIds.length} ਸਰੋਤ ਬੈਚ ਇਸ ਲਾਟ ਨਾਲ ਜੁੜੇ ਹਨ।`, `${lot.passportIds.length} स्रोत बैच इस लॉट से जुड़े हैं।`)}</p>
            </div>
          </section>
          <aside className="h-fit rounded-[1.5rem] border border-border bg-card p-6">
            <p className="eyebrow">{text("Pickup terms", "ਚੁੱਕਾਈ ਦੀਆਂ ਸ਼ਰਤਾਂ", "पिकअप की शर्तें")}</p>
            <h2 className="mt-3 font-display text-3xl">{text("Buyer arranges collection", "ਖਰੀਦਦਾਰ ਚੁੱਕਾਈ ਕਰੇਗਾ", "खरीदार पिकअप करेगा")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text("This is an ex-yard listing. Submit a purchase request from the market page and our team will confirm volume and pickup timing.", "ਇਹ ਯਾਰਡ ਤੋਂ ਵਿਕਰੀ ਵਾਲੀ ਲਿਸਟਿੰਗ ਹੈ। ਮੰਡੀ ਪੇਜ ਤੋਂ ਖਰੀਦ ਬੇਨਤੀ ਭੇਜੋ; ਸਾਡੀ ਟੀਮ ਮਾਤਰਾ ਅਤੇ ਚੁੱਕਾਈ ਸਮਾਂ ਪੱਕਾ ਕਰੇਗੀ।", "यह एक्स-यार्ड लिस्टिंग है। बाज़ार पेज से खरीद अनुरोध भेजें; हमारी टीम मात्रा और पिकअप समय की पुष्टि करेगी।")}</p>
            <div className="mt-5"><PickupPolicyNotice /></div>
            <Button asChild className="mt-6 w-full"><Link href="/market">{text("Return to available lots", "ਉਪਲਬਧ ਲਾਟਾਂ ਵੱਲ ਵਾਪਸ", "उपलब्ध लॉट पर वापस जाएँ")}</Link></Button>
          </aside>
        </div>
      </main>
    </div>
  );
}
