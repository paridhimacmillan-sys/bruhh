import { QrCode, ShieldCheck, MapPin, Scale, IndianRupee, Factory } from "lucide-react";

const ledger = [
  { label: "Field registered", detail: "Cluster PB-07 · Sangrur", time: "12 Oct 2025" },
  { label: "Baled & weighed", detail: "Weighbridge WB-114 · 4.2 t", time: "28 Oct 2025" },
  { label: "Farmer paid", detail: "₹1,680 · settled at weighbridge", time: "28 Oct 2025" },
  { label: "Delivered to buyer", detail: "Verified board mill · 41 km", time: "30 Oct 2025" },
];

export function PassportMock() {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_60px_-30px_oklch(0.36_0.055_152_/_0.45)]">
      <div className="overflow-hidden rounded-[1.5rem] border border-border">
        <div className="bg-primary px-5 py-6 text-primary-foreground">
          <div className="flex items-center justify-between">
            <span className="text-[0.65rem] uppercase tracking-[0.18em] opacity-80">Digital Product Passport</span>
            <QrCode className="h-5 w-5 opacity-80" />
          </div>
          <p className="mt-3 font-display text-xl">Moulded fibre plate · 12"</p>
          <p className="text-xs opacity-75">Passport ID DPP-2025-PB07-0431</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-straw px-3 py-1 text-xs font-medium text-straw-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Verified residue origin
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-secondary text-center">
          {[
            { icon: Scale, v: "4.2 t", l: "Diverted" },
            { icon: IndianRupee, v: "1,680", l: "Farmer paid" },
            { icon: MapPin, v: "41 km", l: "Transport" },
          ].map(({ icon: Icon, v, l }) => (
            <div key={l} className="px-2 py-4">
              <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">{v}</p>
              <p className="text-[0.65rem] text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <div className="bg-card px-5 py-5">
          <p className="eyebrow">Chain of custody</p>
          <ol className="mt-3 space-y-3">
            {ledger.map((e, i) => (
              <li key={e.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  {i < ledger.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-medium leading-tight">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{e.detail}</p>
                  <p className="text-[0.65rem] text-muted-foreground/80">{e.time}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
            <Factory className="h-3.5 w-3.5" /> Buyer &amp; mill certified · geo-tag on record
          </div>
        </div>
      </div>
    </div>
  );
}
