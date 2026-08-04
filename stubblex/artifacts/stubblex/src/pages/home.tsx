import {
  Flame, Wind, SearchX, ClipboardList, Handshake, Truck,
  BadgeIndianRupee, Factory, Leaf,
  Route as RouteIcon, Boxes,
} from "lucide-react";
import { getListLotsQueryKey, useListLots } from "@workspace/api-client-react";
import { Link } from "wouter";
import heroField from "@/assets/hero-field.jpg";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/button";
import { LanguageToggle, useLanguage } from "@/lib/language";

const nav = [
  { label: "Market", pa: "ਮੰਡੀ", hi: "बाज़ार", href: "/market" },
  { label: "Problem", pa: "ਸਮੱਸਿਆ", hi: "समस्या", href: "#problem" },
  { label: "How it works", pa: "ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ", hi: "कैसे काम करता है", href: "#how" },
  { label: "Farmers", pa: "ਕਿਸਾਨ", hi: "किसान", href: "#farmers" },
  { label: "Buyers", pa: "ਖਰੀਦਦਾਰ", hi: "खरीदार", href: "#buyers" },
];

const problems = [
  { icon: Flame, title: "Burning is the default", pa: "ਸਾੜਨਾ ਆਮ ਚੋਣ ਹੈ", hi: "जलाना सामान्य विकल्प है", body: "Roughly 20 million tonnes of paddy residue is generated in Punjab each season, and the field must be cleared for the next sowing in days.", bodyPa: "ਪੰਜਾਬ ਵਿੱਚ ਹਰ ਸੀਜ਼ਨ ਲਗਭਗ 2 ਕਰੋੜ ਟਨ ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਬਣਦੀ ਹੈ ਅਤੇ ਅਗਲੀ ਬਿਜਾਈ ਲਈ ਖੇਤ ਕੁਝ ਦਿਨਾਂ ਵਿੱਚ ਸਾਫ਼ ਕਰਨਾ ਪੈਂਦਾ ਹੈ।", bodyHi: "पंजाब में हर सीज़न लगभग 2 करोड़ टन धान-पराली बनती है और अगली बुवाई के लिए खेत कुछ दिनों में साफ़ करना पड़ता है।" },
  { icon: Wind, title: "Seasonal air crisis", pa: "ਮੌਸਮੀ ਹਵਾ ਸੰਕਟ", hi: "मौसमी वायु संकट", body: "Field fires drive the annual smog episodes across North India, with health costs borne by the same rural districts.", bodyPa: "ਖੇਤਾਂ ਦੀ ਅੱਗ ਉੱਤਰੀ ਭਾਰਤ ਵਿੱਚ ਸਾਲਾਨਾ ਧੂੰਏਂ ਨੂੰ ਵਧਾਉਂਦੀ ਹੈ ਅਤੇ ਪਿੰਡਾਂ ਨੂੰ ਸਿਹਤ ਦੀ ਕੀਮਤ ਚੁਕਾਉਣੀ ਪੈਂਦੀ ਹੈ।", bodyHi: "खेतों की आग उत्तर भारत में सालाना धुंध बढ़ाती है और ग्रामीण इलाकों को स्वास्थ्य की कीमत चुकानी पड़ती है।" },
  { icon: SearchX, title: "No traceable supply", pa: "ਪਤਾ ਲਗਾਉਣ ਯੋਗ ਸਪਲਾਈ ਨਹੀਂ", hi: "पता लगाने योग्य आपूर्ति नहीं", body: "Industries that want agri-residue cannot secure predictable volumes, and cannot prove where a tonne came from.", bodyPa: "ਪਰਾਲੀ ਚਾਹੁੰਦੇ ਉਦਯੋਗ ਪੱਕੀ ਮਾਤਰਾ ਨਹੀਂ ਲੈ ਸਕਦੇ ਅਤੇ ਇਹ ਸਾਬਤ ਨਹੀਂ ਕਰ ਸਕਦੇ ਕਿ ਟਨ ਕਿੱਥੋਂ ਆਇਆ।", bodyHi: "पराली चाहने वाले उद्योग तय मात्रा नहीं पा सकते और यह साबित नहीं कर सकते कि टन कहाँ से आया।" },
];

const steps = [
  { icon: ClipboardList, title: "Register supply", pa: "ਸਪਲਾਈ ਦਰਜ ਕਰੋ", hi: "आपूर्ति दर्ज करें", body: "Farmers and FPOs list available stubble by cluster before harvest.", bodyPa: "ਕਿਸਾਨ ਅਤੇ FPO ਵਾਢੀ ਤੋਂ ਪਹਿਲਾਂ ਕਲੱਸਟਰ ਅਨੁਸਾਰ ਪਰਾਲੀ ਦਰਜ ਕਰਦੇ ਹਨ।", bodyHi: "किसान और FPO कटाई से पहले क्लस्टर के अनुसार पराली दर्ज करते हैं।" },
  { icon: Handshake, title: "Buyers commit", pa: "ਖਰੀਦਦਾਰ ਵਚਨ ਦਿੰਦੇ ਹਨ", hi: "खरीदार प्रतिबद्ध होते हैं", body: "Industrial buyers lock volumes ahead of the season, within a 30–50 km radius.", bodyPa: "ਉਦਯੋਗਿਕ ਖਰੀਦਦਾਰ 30–50 ਕਿਮੀ ਦਾਇਰੇ ਵਿੱਚ ਸੀਜ਼ਨ ਤੋਂ ਪਹਿਲਾਂ ਮਾਤਰਾ ਪੱਕੀ ਕਰਦੇ ਹਨ।", bodyHi: "औद्योगिक खरीदार 30–50 किमी दायरे में सीज़न से पहले मात्रा तय करते हैं।" },
  { icon: Truck, title: "Coordinate pickup", pa: "ਚੁੱਕਾਈ ਦਾ ਤਾਲਮੇਲ", hi: "उठान समन्वय", body: "Third-party balers, rakes and trucks are scheduled across the ~20-day window.", bodyPa: "ਲਗਭਗ 20 ਦਿਨਾਂ ਵਿੱਚ ਬੇਲਰ, ਰੇਕ ਅਤੇ ਟਰੱਕ ਤੈਅ ਕੀਤੇ ਜਾਂਦੇ ਹਨ।", bodyHi: "लगभग 20 दिनों में बेलर, रेक और ट्रक तय किए जाते हैं।" },
  { icon: BadgeIndianRupee, title: "Pay at the weighbridge", pa: "ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਭੁਗਤਾਨ", hi: "वेब्रिज पर भुगतान", body: "Advance-funded payouts settle on weighment — no delayed settlement.", bodyPa: "ਅਗਾਊਂ ਫੰਡ ਨਾਲ ਵਜ਼ਨ ਦੇ ਸਮੇਂ ਭੁਗਤਾਨ ਹੁੰਦਾ ਹੈ—ਕੋਈ ਦੇਰੀ ਨਹੀਂ।", bodyHi: "अग्रिम फंड से वज़न के समय भुगतान होता है—कोई देरी नहीं।" },
  { icon: Factory, title: "Manufacture", pa: "ਨਿਰਮਾਣ", hi: "निर्माण", body: "Residue becomes boards, plates and packaging at the buyer's mill.", bodyPa: "ਖਰੀਦਦਾਰ ਦੀ ਮਿੱਲ ਵਿੱਚ ਪਰਾਲੀ ਤੋਂ ਬੋਰਡ, ਪਲੇਟਾਂ ਅਤੇ ਪੈਕੇਜਿੰਗ ਬਣਦੀ ਹੈ।", bodyHi: "खरीदार की मिल में पराली से बोर्ड, प्लेट और पैकेजिंग बनती है।" },
];

const diffs = [
  { icon: Boxes, title: "Asset-light", pa: "ਘੱਟ ਸੰਪਤੀ", hi: "कम परिसंपत्ति", body: "No balers, trucks or warehouses owned. We coordinate the logistics and equipment that already exist.", bodyPa: "ਅਸੀਂ ਬੇਲਰ, ਟਰੱਕ ਜਾਂ ਗੋਦਾਮ ਨਹੀਂ ਰੱਖਦੇ; ਮੌਜੂਦਾ ਸਾਜ਼ੋ-ਸਾਮਾਨ ਦਾ ਤਾਲਮੇਲ ਕਰਦੇ ਹਾਂ।", bodyHi: "हम बेलर, ट्रक या गोदाम नहीं रखते; मौजूदा साधनों का समन्वय करते हैं।" },
  { icon: RouteIcon, title: "Geography-matched", pa: "ਭੂਗੋਲ ਅਨੁਸਾਰ ਮੇਲ", hi: "भूगोल के अनुसार मिलान", body: "A 30–50 km radius rule pairs supply clusters with nearby buyers, cutting freight cost and emissions.", bodyPa: "30–50 ਕਿਮੀ ਦਾ ਨਿਯਮ ਸਪਲਾਈ ਨੂੰ ਨੇੜਲੇ ਖਰੀਦਦਾਰਾਂ ਨਾਲ ਜੋੜਦਾ ਹੈ।", bodyHi: "30–50 किमी का नियम आपूर्ति को पास के खरीदारों से जोड़ता है।" },
  { icon: BadgeIndianRupee, title: "Producer-first", pa: "ਉਤਪਾਦਕ ਪਹਿਲਾਂ", hi: "उत्पादक पहले", body: "Fair, fast payment at the weighbridge is the design constraint, not an afterthought.", bodyPa: "ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਨਿਆਇਕ ਅਤੇ ਤੇਜ਼ ਭੁਗਤਾਨ ਪਹਿਲੀ ਤਰਜੀਹ ਹੈ।", bodyHi: "वेब्रिज पर उचित और तेज़ भुगतान पहली प्राथमिकता है।" },
  { icon: Leaf, title: "Provenance, not claims", pa: "ਸਬੂਤ, ਸਿਰਫ਼ ਦਾਅਵੇ ਨਹੀਂ", hi: "प्रमाण, केवल दावे नहीं", body: "Every tonne carries a tamper-resistant record buyers and consumers can check themselves.", bodyPa: "ਹਰ ਟਨ ਨਾਲ ਛੇੜਛਾੜ-ਰੋਧੀ ਰਿਕਾਰਡ ਹੈ ਜੋ ਖਰੀਦਦਾਰ ਅਤੇ ਗਾਹਕ ਜਾਂਚ ਸਕਦੇ ਹਨ।", bodyHi: "हर टन के साथ छेड़छाड़-रोधी रिकॉर्ड है जिसे खरीदार और उपभोक्ता जांच सकते हैं।" },
];

const stats = [
  { v: "30–50 km", l: "Supply–buyer matching radius", pa: "ਸਪਲਾਈ–ਖਰੀਦਦਾਰ ਮੇਲ ਦਾਇਰਾ", hi: "आपूर्ति–खरीदार मिलान दायरा" },
  { v: "3,400 t", l: "Sangrur pilot-season target", pa: "ਸੰਗਰੂਰ ਪਾਇਲਟ ਸੀਜ਼ਨ ਟੀਚਾ", hi: "संगरूर पायलट सीज़न लक्ष्य" },
  { v: "₹400/t", l: "Farmer payment at weighbridge", pa: "ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਕਿਸਾਨ ਭੁਗਤਾਨ", hi: "वेब्रिज पर किसान भुगतान" },
  { v: "₹1,700/t", l: "Pilot sale price to buyers", pa: "ਖਰੀਦਦਾਰਾਂ ਲਈ ਪਾਇਲਟ ਮੁੱਲ", hi: "खरीदारों के लिए पायलट मूल्य" },
];

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`section ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">{children}</div>
    </section>
  );
}

function LiveMarketStrip() {
  const { text } = useLanguage();
  const { data: lots = [] } = useListLots({ query: { queryKey: getListLotsQueryKey(), retry: false } });
  return (
    <Section className="border-t border-border bg-straw/30 !py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{text("Live market", "ਲਾਈਵ ਮੰਡੀ", "लाइव बाज़ार")}</p><h2 className="mt-2 font-display text-2xl">{text("Fresh from Sangrur yards", "ਸੰਗਰੂਰ ਯਾਰਡਾਂ ਤੋਂ ਤਾਜ਼ਾ", "संगरूर यार्डों से ताज़ा")}</h2></div>
        <Link href="/market" className="text-sm font-medium text-primary">{text("See all lots", "ਸਾਰੇ ਲਾਟ ਵੇਖੋ", "सभी लॉट देखें")} →</Link>
      </div>
      <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        {lots.slice(0, 3).map((lot) => (
          <Link key={lot.id} href={`/market/${lot.id}`} className="group bg-card p-5 transition-colors hover:bg-secondary">
            <div className="flex items-start justify-between gap-3"><p className="font-mono text-xs text-primary">{lot.id}</p><span className="rounded-full bg-primary/10 px-2 py-1 text-[0.6rem] font-medium capitalize text-primary">{lot.status}</span></div>
            <p className="mt-4 font-display text-2xl">{lot.tonnes} t</p>
            <p className="mt-1 text-xs text-muted-foreground">{lot.clusterName} · {lot.yardName} · ₹{lot.priceInrPerTonne.toLocaleString("en-IN")}/t</p>
          </Link>
        ))}
        {lots.length === 0 && <div className="col-span-3 bg-card p-5 text-sm text-muted-foreground">Market lots are loading…</div>}
      </div>
    </Section>
  );
}

export function Home() {
  const { text } = useLanguage();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="font-display text-lg tracking-tight">
            Unpack<span className="text-primary">os</span>
            <span className="ml-2 hidden text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              UnpackOS
            </span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {text(n.label, n.pa, n.hi)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href="#contact">{text("Get involved", "ਜੁੜੋ", "जुड़ें")}</a>
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <Section className="pt-14 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="eyebrow">{text("Punjab · Paddy residue marketplace", "ਪੰਜਾਬ · ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਦੀ ਮੰਡੀ", "पंजाब · धान-पराली बाज़ार")}</p>
              <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
                {text("Stubble is not waste.", "ਪਰਾਲੀ ਕੂੜਾ ਨਹੀਂ।", "पराली कचरा नहीं।")}<br />{text("It is raw material with a receipt.", "ਇਹ ਰਸੀਦ ਵਾਲਾ ਕੱਚਾ ਮਾਲ ਹੈ।", "यह रसीद वाला कच्चा माल है।")}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                {text("Unpackos connects geolocated farmer clusters and FPOs with industries that need crop residue — coordinating baling and pickup in the 20-day harvest window and paying farmers at the weighbridge.", "Unpackos ਸਥਾਨ-ਚਿੰਨ੍ਹਿਤ ਕਿਸਾਨ ਕਲੱਸਟਰਾਂ ਅਤੇ FPO ਨੂੰ ਪਰਾਲੀ ਦੀ ਲੋੜ ਵਾਲੇ ਉਦਯੋਗਾਂ ਨਾਲ ਜੋੜਦਾ ਹੈ—20 ਦਿਨਾਂ ਦੀ ਵਾਢੀ ਮਿਆਦ ਵਿੱਚ ਗੱਠਾਂ ਅਤੇ ਚੁੱਕਾਈ ਦਾ ਤਾਲਮੇਲ ਅਤੇ ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਕਿਸਾਨ ਭੁਗਤਾਨ।", "Unpackos स्थान-चिह्नित किसान क्लस्टरों और FPO को पराली की जरूरत वाले उद्योगों से जोड़ता है—20 दिन की कटाई अवधि में गांठ और उठान समन्वय तथा वेब्रिज पर किसान भुगतान।")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><a href="#farmers">{text("For farmers & FPOs", "ਕਿਸਾਨਾਂ ਅਤੇ FPO ਲਈ", "किसानों और FPO के लिए")}</a></Button>
                <Button asChild size="lg" variant="outline"><a href="#buyers">{text("For buyers", "ਖਰੀਦਦਾਰਾਂ ਲਈ", "खरीदारों के लिए")}</a></Button>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">Pre-pilot stage · asset-light · producer-first</p>
            </div>
            <div className="relative">
              <img src={heroField} alt="Baled paddy stubble laid out across a harvested field in Punjab at dawn" width={1600} height={1008} className="aspect-[4/3] w-full rounded-lg object-cover bg-muted" />
              <div className="absolute -bottom-6 left-4 hidden rounded-lg border border-border bg-card px-5 py-4 shadow-sm sm:block">
                <p className="eyebrow">Per pickup</p>
                <p className="mt-1 font-display text-lg">Geo-tag · weight · payout · buyer</p>
              </div>
            </div>
          </div>
        </Section>

        <LiveMarketStrip />

        {/* Problem */}
        <Section id="problem" className="border-t border-border bg-secondary">
          <p className="eyebrow">{text("The problem", "ਸਮੱਸਿਆ", "समस्या")}</p>
          <h2 className="mt-4 max-w-2xl text-3xl md:text-4xl">{text("The residue has value. The window to move it does not wait.", "ਪਰਾਲੀ ਦੀ ਕੀਮਤ ਹੈ। ਪਰ ਇਸਨੂੰ ਚੁੱਕਣ ਦਾ ਸਮਾਂ ਉਡੀਕ ਨਹੀਂ ਕਰਦਾ।", "पराली की कीमत है। लेकिन इसे उठाने का समय इंतज़ार नहीं करता।")}</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {problems.map((p) => (
              <div key={p.title} className="border-t border-border pt-6">
                <p.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-xl">{text(p.title, p.pa, p.hi)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text(p.body, p.bodyPa, p.bodyHi)}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section id="how" className="border-t border-border">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{text("How it works", "ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ", "कैसे काम करता है")}</p>
              <h2 className="mt-4 text-3xl md:text-4xl">{text("From field to shelf, in one ledger", "ਖੇਤ ਤੋਂ ਸ਼ੈਲਫ਼ ਤੱਕ, ਇੱਕ ਲੇਜ਼ਰ ਵਿੱਚ", "खेत से शेल्फ तक, एक लेज़र में")}</h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">{text("Unpackos owns no equipment. It sequences the people and assets already working the harvest, and records what happened.", "Unpackos ਕੋਈ ਸਾਜ਼ੋ-ਸਾਮਾਨ ਨਹੀਂ ਰੱਖਦਾ। ਇਹ ਵਾਢੀ ਵਿੱਚ ਕੰਮ ਕਰਦੇ ਲੋਕਾਂ ਅਤੇ ਸਾਧਨਾਂ ਦਾ ਤਾਲਮੇਲ ਕਰਕੇ ਘਟਨਾਵਾਂ ਦਰਜ ਕਰਦਾ ਹੈ।", "Unpackos कोई उपकरण नहीं रखता। यह कटाई में काम कर रहे लोगों और साधनों का समन्वय कर घटनाएँ दर्ज करता है।")}</p>
          </div>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="bg-card p-6">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-primary" />
                  <span className="font-display text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-lg">{text(s.title, s.pa, s.hi)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text(s.body, s.bodyPa, s.bodyHi)}</p>
              </li>
            ))}
            <li className="bg-primary p-6 text-primary-foreground">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] opacity-75">{text("Result", "ਨਤੀਜਾ", "परिणाम")}</p>
              <h3 className="mt-4 text-lg text-primary-foreground">{text("A field not burned", "ਇੱਕ ਖੇਤ ਜੋ ਨਹੀਂ ਸਾੜਿਆ", "एक खेत जो नहीं जला")}</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-85">{text("Paid farmer, supplied mill, verifiable product.", "ਕਿਸਾਨ ਨੂੰ ਭੁਗਤਾਨ, ਮਿੱਲ ਨੂੰ ਸਪਲਾਈ, ਤਸਦੀਕਯੋਗ ਉਤਪਾਦ।", "किसान को भुगतान, मिल को आपूर्ति, सत्यापन योग्य उत्पाद।")}</p>
            </li>
          </ol>
        </Section>

        {/* Farmers */}
        <Section id="farmers" className="border-t border-border">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">{text("For farmers & FPOs", "ਕਿਸਾਨਾਂ ਅਤੇ FPO ਲਈ", "किसानों और FPO के लिए")}</p>
              <h2 className="mt-4 text-3xl md:text-4xl">{text("Earn from the stubble you were burning.", "ਜਿਹੜੀ ਪਰਾਲੀ ਸਾੜਦੇ ਸੀ, ਉਸ ਤੋਂ ਕਮਾਈ ਕਰੋ।", "जिस पराली को जलाते थे, उससे कमाई करें।")}</h2>
              <ul className="mt-8 space-y-5">
                {[[text("No equipment to buy","ਕੋਈ ਸਾਜ਼ੋ-ਸਾਮਾਨ ਨਹੀਂ ਖਰੀਦਣਾ","कोई उपकरण नहीं खरीदना"),text("Balers, rakes and trucks are arranged for you through existing operators.","ਮੌਜੂਦਾ ਓਪਰੇਟਰਾਂ ਰਾਹੀਂ ਬੇਲਰ, ਰੇਕ ਅਤੇ ਟਰੱਕ ਦਾ ਪ੍ਰਬੰਧ ਹੁੰਦਾ ਹੈ।","मौजूदा ऑपरेटरों से बेलर, रेक और ट्रक की व्यवस्था होती है।")],[text("Simple quantity listing","ਸੌਖੀ ਮਾਤਰਾ ਲਿਸਟਿੰਗ","आसान मात्रा लिस्टिंग"),text("Tell us the approximate tonnes available. The field operator verifies the quantity during the farm visit.","ਉਪਲਬਧ ਪਰਾਲੀ ਦੇ ਲਗਭਗ ਟਨ ਦੱਸੋ। ਫ਼ੀਲਡ ਓਪਰੇਟਰ ਖੇਤ ਦੇ ਦੌਰੇ ਦੌਰਾਨ ਮਾਤਰਾ ਦੀ ਜਾਂਚ ਕਰਦਾ ਹੈ।","उपलब्ध पराली के लगभग टन बताएं। फील्ड ऑपरेटर खेत के दौरे में मात्रा की जाँच करता है।")],[text("Paid at the weighbridge","ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਭੁਗਤਾਨ","वेब्रिज पर भुगतान"),text("The final weight is measured at the weighbridge and your receipt is sent by SMS.","ਅੰਤਿਮ ਵਜ਼ਨ ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਹੁੰਦਾ ਹੈ ਅਤੇ ਰਸੀਦ SMS ਰਾਹੀਂ ਮਿਲਦੀ ਹੈ।","अंतिम वज़न वेब्रिज पर होता है और रसीद SMS से मिलती है।")],[text("A clean field on time","ਸਮੇਂ ਸਿਰ ਸਾਫ਼ ਖੇਤ","समय पर साफ़ खेत"),text("Residue leaves the plot in days, ready for the next sowing.","ਪਰਾਲੀ ਕੁਝ ਦਿਨਾਂ ਵਿੱਚ ਖੇਤ ਤੋਂ ਨਿਕਲਦੀ ਹੈ ਅਤੇ ਅਗਲੀ ਬਿਜਾਈ ਲਈ ਤਿਆਰ ਹੁੰਦਾ ਹੈ।","पराली कुछ दिनों में खेत से निकलती है और अगली बुवाई के लिए तैयार होता है।")]].map(([t, d]) => (
                  <li key={t} className="border-l-2 border-straw pl-4">
                    <p className="font-semibold">{t}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 md:p-8">
              <p className="eyebrow">{text("Getting started", "ਸ਼ੁਰੂਆਤ", "शुरुआत")}</p>
              <ol className="mt-5 space-y-5">
                {[text("Register with your phone number, village and approximate tonnes of stubble available.","ਫ਼ੋਨ ਨੰਬਰ, ਪਿੰਡ ਅਤੇ ਉਪਲਬਧ ਪਰਾਲੀ ਦੇ ਲਗਭਗ ਟਨ ਨਾਲ ਦਰਜ ਕਰੋ।","फ़ोन नंबर, गाँव और उपलब्ध पराली के लगभग टन के साथ दर्ज करें।"),text("Our team normally calls within 2 working days to understand your farm and arrange a visit.","ਸਾਡੀ ਟੀਮ ਆਮ ਤੌਰ 'ਤੇ 2 ਕੰਮਕਾਜੀ ਦਿਨਾਂ ਵਿੱਚ ਫ਼ੋਨ ਕਰਕੇ ਖੇਤ ਬਾਰੇ ਜਾਣਦੀ ਅਤੇ ਦੌਰਾ ਤੈਅ ਕਰਦੀ ਹੈ।","हमारी टीम आम तौर पर 2 कार्य दिवस में फ़ोन करके खेत की जानकारी लेती और दौरा तय करती है।"),text("An Unpackos field operator visits the farm, checks or collects documents, maps the field and verifies the listed quantity.","Unpackos ਫ਼ੀਲਡ ਓਪਰੇਟਰ ਖੇਤ ਦਾ ਦੌਰਾ ਕਰਦਾ, ਦਸਤਾਵੇਜ਼ ਜਾਂਚਦਾ ਜਾਂ ਲੈਂਦਾ, ਖੇਤ ਮੈਪ ਕਰਦਾ ਅਤੇ ਦਰਜ ਮਾਤਰਾ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ।","Unpackos फील्ड ऑपरेटर खेत का दौरा करता, दस्तावेज़ जाँचता या लेता, खेत मैप करता और दर्ज मात्रा की पुष्टि करता है।"),text("A decision is usually shared within 3–5 working days after the visit, depending on local capacity and buyer demand.","ਦੌਰੇ ਤੋਂ ਬਾਅਦ ਆਮ ਤੌਰ 'ਤੇ 3–5 ਕੰਮਕਾਜੀ ਦਿਨਾਂ ਵਿੱਚ ਫ਼ੈਸਲਾ ਦੱਸਿਆ ਜਾਂਦਾ ਹੈ; ਇਹ ਸਥਾਨਕ ਸਮਰੱਥਾ ਅਤੇ ਖਰੀਦਦਾਰ ਦੀ ਮੰਗ ਉੱਤੇ ਨਿਰਭਰ ਹੈ।","दौरे के बाद आम तौर पर 3–5 कार्य दिवस में निर्णय बताया जाता है; यह स्थानीय क्षमता और खरीदार की मांग पर निर्भर है।"),text("If accepted, you receive the pickup date, rate and your operator's contact. Final tonnes are measured at the weighbridge and the receipt arrives by SMS.","ਮਨਜ਼ੂਰ ਹੋਣ 'ਤੇ ਚੁੱਕਾਈ ਦੀ ਤਾਰੀਖ਼, ਦਰ ਅਤੇ ਓਪਰੇਟਰ ਦਾ ਸੰਪਰਕ ਮਿਲਦਾ ਹੈ। ਅੰਤਿਮ ਟਨ ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਮਾਪੇ ਜਾਂਦੇ ਹਨ ਅਤੇ ਰਸੀਦ SMS ਰਾਹੀਂ ਆਉਂਦੀ ਹੈ।","स्वीकृत होने पर पिकअप तारीख, दर और ऑपरेटर का संपर्क मिलता है। अंतिम टन वेब्रिज पर मापे जाते हैं और रसीद SMS से आती है।")].map((t, i) => (
                  <li key={t} className="flex gap-4">
                    <span className="font-display text-sm text-muted-foreground">0{i + 1}</span>
                    <span className="text-sm leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 rounded-md border border-straw bg-straw/30 p-4 text-sm leading-relaxed text-straw-foreground">{text("List your best approximate tonnes. If more stubble becomes available later—because of additional land or another field—call your assigned field operator and they will update the listing. The weighbridge measurement remains final.","ਆਪਣਾ ਸਭ ਤੋਂ ਵਧੀਆ ਲਗਭਗ ਟਨ ਦਰਜ ਕਰੋ। ਜੇ ਬਾਅਦ ਵਿੱਚ ਹੋਰ ਜ਼ਮੀਨ ਜਾਂ ਹੋਰ ਖੇਤ ਕਰਕੇ ਵਧੇਰੇ ਪਰਾਲੀ ਮਿਲੇ, ਆਪਣੇ ਫ਼ੀਲਡ ਓਪਰੇਟਰ ਨੂੰ ਫ਼ੋਨ ਕਰੋ; ਉਹ ਲਿਸਟਿੰਗ ਅਪਡੇਟ ਕਰੇਗਾ। ਵੇਅਬ੍ਰਿਜ ਦਾ ਵਜ਼ਨ ਅੰਤਿਮ ਰਹੇਗਾ।","अपना सबसे अच्छा अनुमानित टन दर्ज करें। यदि बाद में अतिरिक्त जमीन या दूसरे खेत से अधिक पराली मिले, अपने फील्ड ऑपरेटर को फ़ोन करें; वे लिस्टिंग अपडेट करेंगे। वेब्रिज का वज़न अंतिम रहेगा।")}</p>
              <Button asChild className="mt-8 w-full"><a href="#contact">{text("Register your cluster", "ਆਪਣਾ ਕਲੱਸਟਰ ਦਰਜ ਕਰੋ", "अपना क्लस्टर दर्ज करें")}</a></Button>
            </div>
          </div>
        </Section>

        {/* Buyers */}
        <Section id="buyers" className="border-t border-border bg-secondary">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">{text("For buyers & manufacturers", "ਖਰੀਦਦਾਰਾਂ ਅਤੇ ਨਿਰਮਾਤਾਵਾਂ ਲਈ", "खरीदारों और निर्माताओं के लिए")}</p>
              <h2 className="mt-4 text-3xl md:text-4xl">{text("Committed volumes, and a sourcing story you can prove.", "ਪੱਕੀ ਮਾਤਰਾ ਅਤੇ ਸੋਰਸਿੰਗ ਦਾ ਸਬੂਤ।", "तय मात्रा और सोर्सिंग का प्रमाण।")}</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">{text("Board, plate and packaging producers commit volumes ahead of the season and draw from clusters within 30–50 km. Each consignment is backed by field, weighbridge and delivery records.", "ਬੋਰਡ, ਪਲੇਟ ਅਤੇ ਪੈਕੇਜਿੰਗ ਨਿਰਮਾਤਾ ਸੀਜ਼ਨ ਤੋਂ ਪਹਿਲਾਂ ਮਾਤਰਾ ਪੱਕੀ ਕਰਕੇ 30–50 ਕਿਮੀ ਦੇ ਕਲੱਸਟਰਾਂ ਤੋਂ ਲੈਂਦੇ ਹਨ। ਹਰ ਖੇਪ ਨਾਲ ਖੇਤ, ਵੇਅਬ੍ਰਿਜ ਅਤੇ ਡਿਲਿਵਰੀ ਰਿਕਾਰਡ ਹੁੰਦੇ ਹਨ।", "बोर्ड, प्लेट और पैकेजिंग निर्माता सीज़न से पहले मात्रा तय कर 30–50 किमी के क्लस्टरों से लेते हैं। हर खेप के साथ खेत, वेब्रिज और डिलीवरी रिकॉर्ड होते हैं।")}</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              {[[text("Predictable supply","ਪੱਕੀ ਸਪਲਾਈ","तय आपूर्ति"),text("Pre-season commitments across multiple clusters reduce single-source risk.","ਕਈ ਕਲੱਸਟਰਾਂ ਦੀ ਅਗਾਊਂ ਵਚਨਬੱਧਤਾ ਇੱਕ ਸਰੋਤ ਦਾ ਜੋਖਮ ਘਟਾਉਂਦੀ ਹੈ।","कई क्लस्टरों की अग्रिम प्रतिबद्धता एक स्रोत का जोखिम घटाती है।")],[text("Lower freight","ਘੱਟ ਭਾੜਾ","कम भाड़ा"),text("Radius matching keeps haulage short and costs stable.","ਦਾਇਰਾ ਮੇਲ ਆਵਾਜਾਈ ਛੋਟੀ ਅਤੇ ਲਾਗਤ ਸਥਿਰ ਰੱਖਦਾ ਹੈ।","दायरा मिलान ढुलाई छोटी और लागत स्थिर रखता है।")],[text("Audit-ready records","ਆਡਿਟ ਲਈ ਤਿਆਰ ਰਿਕਾਰਡ","ऑडिट-तैयार रिकॉर्ड"),text("Weighbridge-backed provenance for ESG and buyer diligence.","ESG ਅਤੇ ਖਰੀਦਦਾਰ ਜਾਂਚ ਲਈ ਵੇਅਬ੍ਰਿਜ-ਅਧਾਰਿਤ ਮੂਲ।","ESG और खरीदार जाँच के लिए वेब्रिज-आधारित मूल।")],[text("Reliable delivery records","ਭਰੋਸੇਯੋਗ ਡਿਲਿਵਰੀ ਰਿਕਾਰਡ","विश्वसनीय डिलीवरी रिकॉर्ड"),text("Field, weighbridge and buyer records stay linked to each batch.","ਖੇਤ, ਵੇਅਬ੍ਰਿਜ ਅਤੇ ਖਰੀਦਦਾਰ ਰਿਕਾਰਡ ਹਰ ਬੈਚ ਨਾਲ ਜੁੜੇ ਰਹਿੰਦੇ ਹਨ।","खेत, वेब्रिज और खरीदार रिकॉर्ड हर बैच से जुड़े रहते हैं।")]].map(([t, d]) => (
                <div key={t} className="bg-card p-6">
                  <p className="font-semibold">{t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Differentiators */}
        <Section className="border-t border-border">
          <p className="eyebrow">{text("Why it works", "ਇਹ ਕਿਉਂ ਚੱਲਦਾ ਹੈ", "यह क्यों काम करता है")}</p>
          <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {diffs.map((d) => (
              <div key={d.title}>
                <d.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-xl">{text(d.title, d.pa, d.hi)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text(d.body, d.bodyPa, d.bodyHi)}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Impact */}
        <Section className="border-t border-border bg-primary text-primary-foreground">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] opacity-70">{text("Targeted impact", "ਨਿਸ਼ਾਨਾ ਪ੍ਰਭਾਵ", "लक्षित प्रभाव")}</p>
          <h2 className="mt-4 max-w-2xl text-3xl text-primary-foreground md:text-4xl">{text("Pilot-season goals, replaced with real data as it lands.", "ਪਾਇਲਟ ਸੀਜ਼ਨ ਦੇ ਟੀਚੇ, ਅਸਲੀ ਡਾਟਾ ਆਉਣ ਨਾਲ ਬਦਲਦੇ ਜਾਣਗੇ।", "पायलट सीज़न के लक्ष्य, वास्तविक डेटा आने पर बदलते जाएंगे।")}</h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.l} className="border-t border-primary-foreground/25 pt-5">
                <p className="font-display text-4xl">{s.v}</p>
                <p className="mt-2 text-sm opacity-80">{text(s.l, s.pa, s.hi)}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs opacity-70">Pilot parameters — live verified results are recorded batch by batch.</p>
        </Section>

        {/* Contact */}
        <Section id="contact" className="border-t border-border">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">{text("Get involved", "ਜੁੜੋ", "जुड़ें")}</p>
              <h2 className="mt-4 text-3xl md:text-4xl">{text("Talk to us before the next harvest.", "ਅਗਲੀ ਵਾਢੀ ਤੋਂ ਪਹਿਲਾਂ ਸਾਡੇ ਨਾਲ ਗੱਲ ਕਰੋ।", "अगली कटाई से पहले हमसे बात करें।")}</h2>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{text("We are onboarding farmer clusters and FPOs in Punjab, industrial buyers of paddy residue, and logistics partners.", "ਅਸੀਂ ਪੰਜਾਬ ਦੇ ਕਿਸਾਨ ਕਲੱਸਟਰਾਂ, FPO, ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਦੇ ਉਦਯੋਗਿਕ ਖਰੀਦਦਾਰਾਂ ਅਤੇ ਲੋਜਿਸਟਿਕਸ ਭਾਗੀਦਾਰਾਂ ਨੂੰ ਜੋੜ ਰਹੇ ਹਾਂ।", "हम पंजाब के किसान क्लस्टरों, FPO, धान-पराली के औद्योगिक खरीदारों और लॉजिस्टिक्स भागीदारों को जोड़ रहे हैं।")}</p>
              <div className="mt-8 space-y-4 text-sm">
                <p><span className="text-muted-foreground">{text("Farmers & FPOs", "ਕਿਸਾਨ ਅਤੇ FPO", "किसान और FPO")}</span><br />clusters@unpackos.in</p>
                <p><span className="text-muted-foreground">{text("Buyers & manufacturers", "ਖਰੀਦਦਾਰ ਅਤੇ ਨਿਰਮਾਤਾ", "खरीदार और निर्माता")}</span><br />supply@unpackos.in</p>
                <p><span className="text-muted-foreground">{text("Investors & partners", "ਨਿਵੇਸ਼ਕ ਅਤੇ ਭਾਗੀਦਾਰ", "निवेशक और भागीदार")}</span><br />partners@unpackos.in</p>
              </div>
            </div>
            <LeadForm />
          </div>
        </Section>
      </main>

      <footer className="border-t border-border bg-secondary py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-display text-base text-foreground">Unpack<span className="text-primary">os</span></p>
          <p className="text-xs">{text("Early-stage concept site", "ਸ਼ੁਰੂਆਤੀ ਸੰਕਲਪ ਸਾਈਟ", "प्रारंभिक अवधारणा साइट")} · Punjab, India · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
