import { useState } from "react";
import { CheckCircle2, Clock3, FileSearch, ShieldCheck } from "lucide-react";
import { getGetOnboardingApplicationStatusQueryKey, useGetOnboardingApplicationStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialReference = new URLSearchParams(window.location.search).get("reference") ?? "";

export function ApplicationStatusPage() {
  const [referenceInput, setReferenceInput] = useState(initialReference);
  const [phoneInput, setPhoneInput] = useState("");
  const [lookup, setLookup] = useState({ reference: "", phone: "" });
  const query = useGetOnboardingApplicationStatus(lookup, { query: { queryKey: getGetOnboardingApplicationStatusQueryKey(lookup), enabled: Boolean(lookup.reference && lookup.phone), retry: false } });

  return <main className="min-h-screen bg-background px-4 py-8 sm:py-14">
    <div className="mx-auto max-w-xl">
      <a href="/" className="font-display text-2xl">Unpack<span className="text-primary">OS</span></a>
      <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><FileSearch /></div>
        <h1 className="mt-5 font-display text-3xl">Check your application</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use the reference given after submission and the same verified mobile number.</p>
        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); setLookup({ reference: referenceInput.trim().toUpperCase(), phone: phoneInput.replace(/\D/g, "").replace(/^91(?=[6-9][0-9]{9}$)/, "") }); }}>
          <label className="block text-sm font-medium">Application reference<Input className="mt-1" value={referenceInput} onChange={(event) => setReferenceInput(event.target.value)} placeholder="STX-2026-AB12CD34" /></label>
          <label className="block text-sm font-medium">Verified mobile number<Input className="mt-1" type="tel" inputMode="tel" value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} placeholder="98765 43210" /></label>
          <Button className="w-full" size="lg">Check status</Button>
        </form>
        {query.isError && <p className="mt-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">No matching application was found. Check the reference and phone number.</p>}
      </section>

      {query.data && <section className="mt-5 rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{query.data.reference}</p><h2 className="mt-2 font-display text-2xl">{query.data.name}</h2></div><span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">{query.data.status.replaceAll("_", " ")}</span></div>
        <div className="mt-6 flex gap-3 rounded-md bg-secondary/60 p-4"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><p className="text-sm">{query.data.statusMessage}</p></div>
        <div className="mt-6 space-y-4 text-sm">
          <StatusStep icon={<CheckCircle2 />} label="Application submitted" complete />
          <StatusStep icon={<ShieldCheck />} label="Phone verified" complete />
          <StatusStep icon={<FileSearch />} label="UnpackOS review and decision" complete={["verified", "approved", "rejected", "waitlisted"].includes(query.data.status)} />
        </div>
      </section>}
    </div>
  </main>;
}

function StatusStep({ icon, label, complete }: { icon: React.ReactNode; label: string; complete: boolean }) {
  return <div className={`flex items-center gap-3 ${complete ? "text-foreground" : "text-muted-foreground"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${complete ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{icon}</span><span>{label}</span></div>;
}
