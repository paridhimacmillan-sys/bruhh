import {
  Flame, Wind, SearchX, ClipboardList, Handshake, Truck,
  BadgeIndianRupee, FileCheck2, Factory, ScanLine, Leaf,
  Route as RouteIcon, Boxes,
} from "lucide-react";
import heroField from "@/assets/hero-field.jpg";
import { PassportMock } from "@/components/PassportMock";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/button";

const nav = [
  { label: "Problem", href: "#problem" },
  { label: "How it works", href: "#how" },
  { label: "Passport", href: "#passport" },
  { label: "Farmers", href: "#farmers" },
  { label: "Buyers", href: "#buyers" },
];

const problems = [
  { icon: Flame, title: "Burning is the default", body: "Roughly 20 million tonnes of paddy residue is generated in Punjab each season, and the field must be cleared for the next sowing in days." },
  { icon: Wind, title: "Seasonal air crisis", body: "Field fires drive the annual smog episodes across North India, with health costs borne by the same rural districts." },
  { icon: SearchX, title: "No traceable supply", body: "Industries that want agri-residue cannot secure predictable volumes, and cannot prove where a tonne came from." },
];

const steps = [
  { icon: ClipboardList, title: "Register supply", body: "Farmers and FPOs list available stubble by cluster before harvest." },
  { icon: Handshake, title: "Buyers commit", body: "Industrial buyers lock volumes ahead of the season, within a 30–50 km radius." },
  { icon: Truck, title: "Coordinate pickup", body: "Third-party balers, rakes and trucks are scheduled across the ~20-day window." },
  { icon: BadgeIndianRupee, title: "Pay at the weighbridge", body: "Advance-funded payouts settle on weighment — no delayed settlement." },
  { icon: FileCheck2, title: "Issue the passport", body: "Geo-tag, weight, payout and certified buyer are recorded per pickup." },
  { icon: Factory, title: "Manufacture", body: "Residue becomes boards, plates and packaging at the buyer's mill." },
  { icon: ScanLine, title: "Consumers verify", body: "A QR on the finished product opens the verified seal and custody ledger." },
];

const diffs = [
  { icon: Boxes, title: "Asset-light", body: "No balers, trucks or warehouses owned. We coordinate the logistics and equipment that already exist." },
  { icon: RouteIcon, title: "Geography-matched", body: "A 30–50 km radius rule pairs supply clusters with nearby buyers, cutting freight cost and emissions." },
  { icon: BadgeIndianRupee, title: "Producer-first", body: "Fair, fast payment at the weighbridge is the design constraint, not an afterthought." },
  { icon: Leaf, title: "Provenance, not claims", body: "Every tonne carries a tamper-resistant record buyers and consumers can check themselves." },
];

const stats = [
  { v: "20 days", l: "Post-harvest collection window" },
  { v: "30–50 km", l: "Supply–buyer matching radius" },
  { v: "1,000 t", l: "Residue targeted in pilot season" },
  { v: "₹2,100/t", l: "Indicative farmer realisation" },
];

function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`section ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">{children}</div>
    </section>
  );
}

export function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <a href="#top" className="font-display text-lg tracking-tight">
            Stubble<span className="text-primary">X</span>
            <span className="ml-2 hidden text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              UnpackOS
            </span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {n.label}
              </a>
            ))}
          </nav>
          <Button asChild size="sm">
            <a href="#contact">Get involved</a>
          </Button>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <Section className="pt-14 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="eyebrow">Punjab · Paddy residue marketplace</p>
              <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
                Stubble is not waste.<br />It is raw material with a receipt.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                StubbleX connects geolocated farmer clusters and FPOs with industries that need crop residue — coordinating baling and pickup in the 20-day harvest window, paying farmers at the weighbridge, and issuing a Digital Product Passport for every tonne.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><a href="#farmers">For farmers &amp; FPOs</a></Button>
                <Button asChild size="lg" variant="outline"><a href="#buyers">For buyers</a></Button>
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

        {/* Problem */}
        <Section id="problem" className="border-t border-border bg-secondary">
          <p className="eyebrow">The problem</p>
          <h2 className="mt-4 max-w-2xl text-3xl md:text-4xl">The residue has value. The window to move it does not wait.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {problems.map((p) => (
              <div key={p.title} className="border-t border-border pt-6">
                <p.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-xl">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section id="how" className="border-t border-border">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-4 text-3xl md:text-4xl">From field to shelf, in one ledger</h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">StubbleX owns no equipment. It sequences the people and assets already working the harvest, and records what happened.</p>
          </div>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="bg-card p-6">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-primary" />
                  <span className="font-display text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
            <li className="bg-primary p-6 text-primary-foreground">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] opacity-75">Result</p>
              <h3 className="mt-4 text-lg text-primary-foreground">A field not burned</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-85">Paid farmer, supplied mill, verifiable product.</p>
            </li>
          </ol>
        </Section>

        {/* Passport */}
        <Section id="passport" className="border-t border-border bg-secondary">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="eyebrow">The Digital Product Passport</p>
              <h2 className="mt-4 text-3xl md:text-4xl">One scan, and the claim stops being marketing.</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">Every transaction on StubbleX mints a geo-tagged, tamper-resistant record: the originating field, the weight collected, what the farmer was paid, and the certified buyer. Manufacturers carry that passport on the finished product as a QR code.</p>
              <dl className="mt-8 grid gap-6 sm:grid-cols-3">
                {[["Verified seal","Issued only against a weighbridge record."],["Impact numbers","Tonnage diverted and transport distance per unit."],["Custody ledger","Field → baler → weighbridge → mill → SKU."]].map(([t, d]) => (
                  <div key={t}>
                    <dt className="text-sm font-semibold">{t}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">{d}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 text-xs text-muted-foreground">Illustrative passport — sample data shown for demonstration.</p>
            </div>
            <PassportMock />
          </div>
        </Section>

        {/* Farmers */}
        <Section id="farmers" className="border-t border-border">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">For farmers &amp; FPOs</p>
              <h2 className="mt-4 text-3xl md:text-4xl">Earn from the stubble you were burning.</h2>
              <ul className="mt-8 space-y-5">
                {[["No equipment to buy","Balers, rakes and trucks are arranged for you through existing operators."],["Paid at the weighbridge","Payouts are advance-funded, so settlement does not wait on the mill."],["Cluster scheduling","Your FPO registers volumes before harvest and gets a pickup slot in the window."],["A clean field on time","Residue leaves the plot in days, ready for the next sowing."]].map(([t, d]) => (
                  <li key={t} className="border-l-2 border-straw pl-4">
                    <p className="font-semibold">{t}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 md:p-8">
              <p className="eyebrow">Getting started</p>
              <ol className="mt-5 space-y-5">
                {["Share your village, FPO and approximate paddy acreage.","A field coordinator confirms cluster mapping and expected tonnage.","You receive a pickup slot and payout rate before harvest begins.","Bales are weighed, you are paid, and the passport is issued."].map((t, i) => (
                  <li key={t} className="flex gap-4">
                    <span className="font-display text-sm text-muted-foreground">0{i + 1}</span>
                    <span className="text-sm leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
              <Button asChild className="mt-8 w-full"><a href="#contact">Register your cluster</a></Button>
            </div>
          </div>
        </Section>

        {/* Buyers */}
        <Section id="buyers" className="border-t border-border bg-secondary">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">For buyers &amp; manufacturers</p>
              <h2 className="mt-4 text-3xl md:text-4xl">Committed volumes, and a sourcing story you can prove.</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">Board, plate and packaging producers commit volumes ahead of the season and draw from clusters within 30–50 km. Each consignment arrives with its passport, ready to carry onto your SKUs.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              {[["Predictable supply","Pre-season commitments across multiple clusters reduce single-source risk."],["Lower freight","Radius matching keeps haulage short and costs stable."],["Audit-ready records","Weighbridge-backed provenance for ESG and buyer diligence."],["Consumer trust, built in","A per-SKU passport turns sourcing into a scannable claim."]].map(([t, d]) => (
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
          <p className="eyebrow">Why it works</p>
          <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {diffs.map((d) => (
              <div key={d.title}>
                <d.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-xl">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Impact */}
        <Section className="border-t border-border bg-primary text-primary-foreground">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] opacity-70">Targeted impact</p>
          <h2 className="mt-4 max-w-2xl text-3xl text-primary-foreground md:text-4xl">Pilot-season goals, replaced with real data as it lands.</h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.l} className="border-t border-primary-foreground/25 pt-5">
                <p className="font-display text-4xl">{s.v}</p>
                <p className="mt-2 text-sm opacity-80">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs opacity-70">Placeholder figures — indicative targets for the first pilot season, not verified results.</p>
        </Section>

        {/* Contact */}
        <Section id="contact" className="border-t border-border">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">Get involved</p>
              <h2 className="mt-4 text-3xl md:text-4xl">Talk to us before the next harvest.</h2>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">We are onboarding farmer clusters and FPOs in Punjab, industrial buyers of paddy residue, and partners interested in the passport layer.</p>
              <div className="mt-8 space-y-4 text-sm">
                <p><span className="text-muted-foreground">Farmers &amp; FPOs</span><br />clusters@stubblex.in</p>
                <p><span className="text-muted-foreground">Buyers &amp; manufacturers</span><br />supply@stubblex.in</p>
                <p><span className="text-muted-foreground">Investors &amp; partners</span><br />partners@stubblex.in</p>
              </div>
            </div>
            <LeadForm />
          </div>
        </Section>
      </main>

      <footer className="border-t border-border bg-secondary py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-display text-base text-foreground">Stubble<span className="text-primary">X</span> · UnpackOS</p>
          <p className="text-xs">Early-stage concept site · Punjab, India · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
