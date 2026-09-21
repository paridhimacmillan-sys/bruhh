import { Check } from "lucide-react";
import { getGetFarmerReceiptQueryKey, useGetFarmerReceipt, type BatchStatus } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { LanguageToggle, useFarmerReceiptCopy, useLanguage } from "@/lib/language";

const completedSteps: Record<BatchStatus, number> = {
  registered: 0,
  baled: 2,
  paid: 3,
  delivered: 3,
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function FarmerReceiptPage() {
  const { batchId = "" } = useParams<{ batchId: string }>();
  const numericBatchId = Number(batchId);
  const copy = useFarmerReceiptCopy();
  const { language } = useLanguage();
  const { data: receipt, isLoading } = useGetFarmerReceipt(numericBatchId, {
    query: { queryKey: getGetFarmerReceiptQueryKey(numericBatchId), retry: false, enabled: Number.isInteger(numericBatchId) && numericBatchId > 0 },
  });

  const formatDate = (value: string) => new Intl.DateTimeFormat(language === "pa" ? "pa-IN" : language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));

  if (isLoading) {
    return <main className="min-h-screen animate-pulse bg-background px-5 py-8"><div className="mx-auto h-16 max-w-lg rounded-lg bg-secondary" /><div className="mx-auto mt-8 h-96 max-w-lg rounded-lg bg-secondary" /></main>;
  }

  if (!receipt) {
    return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center"><div><div className="font-display text-2xl">Stubble<span className="text-primary">X</span></div><h1 className="mt-8 text-3xl font-semibold">{copy("notFound")}</h1><p className="mt-3 text-lg text-muted-foreground">{copy("tryAgain")}</p><LanguageToggle className="mt-7" /></div></main>;
  }

  const steps = [copy("baled"), copy("weighed"), copy("paid")];
  const done = completedSteps[receipt.status];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto flex min-h-16 max-w-lg items-center justify-between px-5 py-3">
          <div className="font-display text-2xl tracking-tight">Stubble<span className="text-primary">X</span></div>
          <LanguageToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-5 py-8 sm:px-6">
        <p className="text-lg font-semibold uppercase tracking-[0.12em] text-primary">{copy("receipt")} #{receipt.id}</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">{copy("confirmation")}</h1>

        <section className="mt-9 divide-y-2 divide-foreground border-y-2 border-foreground" aria-label={copy("receipt")}>
          <div className="py-6">
            <p className="text-lg font-semibold text-muted-foreground">{copy("weight")}</p>
            <p className="mt-1 text-5xl font-bold leading-none sm:text-6xl">{receipt.weightTonnes} <span className="text-2xl">{copy("tonnes")}</span></p>
          </div>
          <div className="py-6">
            <p className="text-lg font-semibold text-muted-foreground">{copy("amountPaid")}</p>
            <p className="mt-1 text-5xl font-bold leading-none sm:text-6xl">{formatAmount(receipt.farmerPaidInr)}</p>
            <p className="mt-3 text-xl font-semibold text-primary">{copy("fpoAccount")}</p>
          </div>
          <div className="py-6">
            <p className="text-lg font-semibold text-muted-foreground">{copy("paymentDate")}</p>
            <p className="mt-2 text-3xl font-bold leading-tight">{formatDate(receipt.paymentDate)}</p>
          </div>
        </section>

        <ol className="mt-9 space-y-3" aria-label={copy("receipt")}>
          {steps.map((step, index) => {
            const complete = index < done;
            return <li key={step} className={`flex min-h-16 items-center gap-4 rounded-lg border-2 px-4 py-3 text-xl font-bold ${complete ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${complete ? "border-primary-foreground" : "border-border"}`}>{complete && <Check className="h-6 w-6" strokeWidth={3} />}</span><span>{step}</span></li>;
          })}
        </ol>

        <dl className="mt-9 space-y-2 border-t border-border pt-5 text-lg text-muted-foreground">
          <div className="flex justify-between gap-4"><dt>{copy("cluster")}</dt><dd className="text-right font-semibold text-foreground">{receipt.clusterName}</dd></div>
          <div className="flex justify-between gap-4"><dt>{copy("weighbridge")}</dt><dd className="text-right font-mono font-semibold text-foreground">{receipt.weighbridgeId}</dd></div>
        </dl>
      </main>

      <footer className="mt-6 border-t-2 border-foreground bg-card px-5 py-7 text-center">
        <p className="text-2xl font-bold">{copy("footer")}</p>
        <p className="mt-2 font-display text-xl">Stubble<span className="text-primary">X</span></p>
      </footer>
    </div>
  );
}
