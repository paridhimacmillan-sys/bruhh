import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallbackRequest = {
  id: number;
  farmerName: string;
  farmerPhone: string;
  additionalTonnes: number;
  status: "pending" | "contacted" | "resolved";
  createdAt: string;
};

export function FarmerCallbackPanel() {
  const [requests, setRequests] = useState<CallbackRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch("/api/farmer-callback-requests", { credentials: "same-origin" });
      if (response.ok) setRequests(await response.json() as CallbackRequest[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function update(requestId: number, status: "contacted" | "resolved") {
    const response = await fetch(`/api/farmer-callback-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status }),
    });
    if (response.ok) await load();
  }

  if (loading) return <div className="h-24 animate-pulse rounded-lg bg-secondary" />;
  if (requests.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No farmer callback requests.</p>;

  return <div className="divide-y divide-border">{requests.map((request) => <div key={request.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{request.farmerName}</p><span className="rounded-full bg-secondary px-2 py-1 text-[0.65rem] font-semibold capitalize">{request.status}</span></div><p className="mt-1 text-sm text-muted-foreground">Reports {request.additionalTonnes} additional tonnes · {new Date(request.createdAt).toLocaleDateString("en-IN")}</p></div><div className="flex flex-wrap gap-2"><Button asChild size="sm"><a href={`tel:+91${request.farmerPhone}`}><Phone className="mr-2 h-4 w-4" />Call farmer</a></Button>{request.status === "pending" && <Button type="button" size="sm" variant="outline" onClick={() => void update(request.id, "contacted")}>Mark contacted</Button>}{request.status !== "resolved" && <Button type="button" size="sm" variant="outline" onClick={() => void update(request.id, "resolved")}>Resolve</Button>}</div></div>)}</div>;
}
