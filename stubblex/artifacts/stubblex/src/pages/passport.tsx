import {
  ArrowLeft,
  Factory,
  IndianRupee,
  MapPin,
  QrCode,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { getGetBatchQueryKey, useGetBatch, type Batch } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { LanguageToggle, useLanguage } from "@/lib/language";

const statusOrder = {
  registered: 0,
  baled: 1,
  paid: 2,
  delivered: 3,
} as const;

function formatDate(value: string | null): string {
  if (!value) return "Pending";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function PassportNotFound({ passportId }: { passportId: string }) {
  const { text } = useLanguage();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_60px_-30px_oklch(0.36_0.055_152_/_0.45)]">
        <div className="rounded-[1.5rem] border border-border px-6 py-12 text-center sm:px-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <QrCode className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="eyebrow mt-6">{text("Digital Product Passport", "ਡਿਜ਼ਿਟਲ ਪ੍ਰੋਡਕਟ ਪਾਸਪੋਰਟ", "डिजिटल प्रोडक्ट पासपोर्ट")}</p>
          <h1 className="mt-3 font-display text-3xl">{text("Passport not found", "ਪਾਸਪੋਰਟ ਨਹੀਂ ਮਿਲਿਆ", "पासपोर्ट नहीं मिला")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {text("We could not verify", "ਅਸੀਂ ਤਸਦੀਕ ਨਹੀਂ ਕਰ ਸਕੇ", "हम सत्यापित नहीं कर सके")} <span className="font-medium text-foreground">{passportId}</span>. {text("Check the code and scan again.", "ਕੋਡ ਜਾਂਚ ਕੇ ਮੁੜ ਸਕੈਨ ਕਰੋ।", "कोड जांचकर फिर स्कैन करें।")}
          </p>
          <Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary">
            <ArrowLeft className="h-4 w-4" /> {text("Return to StubbleX", "StubbleX ਵਾਪਸ", "StubbleX वापस")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function PassportLoading() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl animate-pulse rounded-[2rem] border border-border bg-card p-3">
        <div className="h-64 rounded-[1.5rem] bg-primary/15" />
        <div className="mt-3 h-28 rounded-[1.5rem] bg-secondary" />
        <div className="mt-3 h-80 rounded-[1.5rem] bg-secondary" />
      </div>
    </main>
  );
}

function PassportRecord({ batch }: { batch: Batch }) {
  const { text } = useLanguage();
  const completedStep = statusOrder[batch.status];
  const clusterCode = batch.passportId.split("-")[2] ?? `#${batch.clusterId}`;
  const baledDate = formatDate(batch.baledAt);
  const deliveredDate = formatDate(batch.deliveredAt);

  const ledger = [
    {
      label: text("Field registered", "ਖੇਤ ਦਰਜ ਹੋਇਆ", "खेत दर्ज हुआ"),
      detail: `${text("Cluster", "ਕਲੱਸਟਰ", "क्लस्टर")} ${clusterCode} · Sangrur`,
      date: baledDate,
    },
    {
      label: text("Baled & weighed", "ਗੱਠਾਂ ਅਤੇ ਵਜ਼ਨ", "गांठें और वज़न"),
      detail: `${text("Weighbridge", "ਵੇਅਬ੍ਰਿਜ", "वेब्रिज")} ${batch.weighbridgeId} · ${batch.weightTonnes} t`,
      date: baledDate,
    },
    {
      label: text("Farmer paid", "ਕਿਸਾਨ ਨੂੰ ਭੁਗਤਾਨ", "किसान को भुगतान"),
      detail: `₹${formatInr(batch.farmerPaidInr)} · ${text("settled at weighbridge", "ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਨਿਪਟਾਰਾ", "वेब्रिज पर निपटान")}`,
      date: baledDate,
    },
    {
      label: text("Delivered to buyer", "ਖਰੀਦਦਾਰ ਨੂੰ ਡਿਲਿਵਰੀ", "खरीदार को डिलीवरी"),
      detail: `${batch.buyerName} · ${batch.distanceKm} km`,
      date: deliveredDate,
    },
  ];

  const stats = [
    { icon: Scale, value: `${batch.weightTonnes} t`, label: text("Tonnes diverted", "ਬਚਾਏ ਟਨ", "बचाए गए टन") },
    { icon: IndianRupee, value: formatInr(batch.farmerPaidInr), label: text("Farmer paid", "ਕਿਸਾਨ ਭੁਗਤਾਨ", "किसान भुगतान") },
    { icon: MapPin, value: `${batch.distanceKm} km`, label: text("Transport", "ਆਵਾਜਾਈ", "परिवहन") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="font-display text-lg tracking-tight" aria-label="StubbleX home">
            Stubble<span className="text-primary">X</span>
          </Link>
          <div className="flex items-center gap-2"><span className="eyebrow hidden sm:inline">{text("Verified record", "ਤਸਦੀਕਸ਼ੁਦਾ ਰਿਕਾਰਡ", "सत्यापित रिकॉर्ड")}</span><LanguageToggle /></div>
        </div>
      </header>

      <main className="px-4 py-5 sm:px-6 sm:py-10">
        <article className="mx-auto w-full max-w-xl rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_60px_-30px_oklch(0.36_0.055_152_/_0.45)]">
          <div className="overflow-hidden rounded-[1.5rem] border border-border">
            <div className="bg-primary px-5 py-7 text-primary-foreground sm:px-8 sm:py-9">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[0.65rem] uppercase tracking-[0.18em] opacity-80">{text("Digital Product Passport", "ਡਿਜ਼ਿਟਲ ਪ੍ਰੋਡਕਟ ਪਾਸਪੋਰਟ", "डिजिटल प्रोडक्ट पासपोर्ट")}</span>
                <QrCode className="h-5 w-5 shrink-0 opacity-80" aria-hidden="true" />
              </div>
              <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">{text("Paddy residue batch", "ਝੋਨੇ ਦੀ ਪਰਾਲੀ ਦਾ ਬੈਚ", "धान-पराली बैच")}</h1>
              <p className="mt-1 break-all text-xs opacity-75">{text("Passport ID", "ਪਾਸਪੋਰਟ ID", "पासपोर्ट ID")} {batch.passportId}</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-straw px-3 py-1.5 text-xs font-medium text-straw-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {text("Verified residue origin", "ਪਰਾਲੀ ਦਾ ਤਸਦੀਕਸ਼ੁਦਾ ਮੂਲ", "पराली का सत्यापित मूल")}
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-secondary text-center">
              {stats.map(({ icon: Icon, value, label }) => (
                <div key={label} className="min-w-0 px-2 py-5 sm:px-4 sm:py-6">
                  <Icon className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 truncate text-sm font-semibold sm:text-base">{value}</p>
                  <p className="mt-0.5 text-[0.6rem] leading-tight text-muted-foreground sm:text-xs">{label}</p>
                </div>
              ))}
            </div>

            <div className="bg-card px-5 py-6 sm:px-8 sm:py-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">{text("Chain of custody", "ਹਿਰਾਸਤ ਲੜੀ", "अभिरक्षा शृंखला")}</p>
                  <h2 className="mt-2 font-display text-2xl">{text("Field to buyer", "ਖੇਤ ਤੋਂ ਖਰੀਦਦਾਰ", "खेत से खरीदार")}</h2>
                </div>
                <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[0.65rem] font-medium capitalize text-muted-foreground">
                  {batch.status}
                </span>
              </div>

              <ol className="mt-7 space-y-4">
                {ledger.map((entry, index) => {
                  const isComplete = index <= completedStep;

                  return (
                    <li key={entry.label} className="flex gap-4">
                      <div className="flex flex-col items-center" aria-hidden="true">
                        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${isComplete ? "bg-primary" : "border border-border bg-card"}`} />
                        {index < ledger.length - 1 && (
                          <span className={`mt-1 w-px flex-1 ${index < completedStep ? "bg-primary/35" : "bg-border"}`} />
                        )}
                      </div>
                      <div className="min-w-0 pb-2">
                        <p className={`text-sm font-medium leading-tight ${isComplete ? "text-foreground" : "text-muted-foreground"}`}>{entry.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.detail}</p>
                        <time className="mt-0.5 block text-[0.65rem] text-muted-foreground/80">{entry.date}</time>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 flex items-start gap-2 rounded-md border border-border bg-secondary px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                <Factory className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{text("Buyer & mill certified · weighbridge verified · geo-tag on record", "ਖਰੀਦਦਾਰ ਅਤੇ ਮਿੱਲ ਤਸਦੀਕਸ਼ੁਦਾ · ਵੇਅਬ੍ਰਿਜ ਤਸਦੀਕਸ਼ੁਦਾ · ਜੀਓ-ਟੈਗ ਦਰਜ", "खरीदार और मिल सत्यापित · वेब्रिज सत्यापित · जियो-टैग दर्ज")}</span>
              </div>
            </div>
          </div>
        </article>
      </main>

      <footer className="px-6 pb-8 pt-2 text-center">
        <p className="mx-auto max-w-md text-[0.7rem] leading-relaxed text-muted-foreground">
          {text("Every record created at the moment its transaction occurred on StubbleX rails.", "ਹਰ ਰਿਕਾਰਡ StubbleX ਰੇਲਾਂ ਉੱਤੇ ਲੈਣ-ਦੇਣ ਦੇ ਸਮੇਂ ਹੀ ਬਣਾਇਆ ਗਿਆ।", "हर रिकॉर्ड StubbleX रेल्स पर लेन-देन के समय ही बनाया गया।")}
        </p>
      </footer>
    </div>
  );
}

export function PassportPage() {
  const { text } = useLanguage();
  const { passportId = "" } = useParams<{ passportId: string }>();
  const { data: batch, error, isLoading } = useGetBatch(passportId, {
    query: { queryKey: getGetBatchQueryKey(passportId), retry: false },
  });

  if (isLoading) return <PassportLoading />;

  const status = (error as { status?: number } | null)?.status;
  if (!batch && (status === 400 || status === 404)) {
    return <PassportNotFound passportId={passportId} />;
  }

  if (!batch) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-12 text-center">
        <div className="max-w-sm">
          <p className="eyebrow">{text("Digital Product Passport", "ਡਿਜ਼ਿਟਲ ਪ੍ਰੋਡਕਟ ਪਾਸਪੋਰਟ", "डिजिटल प्रोडक्ट पासपोर्ट")}</p>
          <h1 className="mt-3 font-display text-3xl">{text("Unable to load passport", "ਪਾਸਪੋਰਟ ਲੋਡ ਨਹੀਂ ਹੋਇਆ", "पासपोर्ट लोड नहीं हुआ")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text("Please check your connection and try scanning the code again.", "ਕਨੈਕਸ਼ਨ ਜਾਂਚ ਕੇ ਕੋਡ ਮੁੜ ਸਕੈਨ ਕਰੋ।", "कनेक्शन जांचकर कोड फिर स्कैन करें।")}</p>
        </div>
      </main>
    );
  }

  return <PassportRecord batch={batch} />;
}
