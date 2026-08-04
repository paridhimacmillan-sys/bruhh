import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getFarmerQuantityRequestPhoto,
  getListFarmerQuantityRequestsQueryKey,
  getListFarmerSuppliersQueryKey,
  useApproveFarmerQuantityRequest,
  useCreateFarmerQuantityRequest,
  useListFarmerQuantityRequests,
  useListFarmerSuppliers,
  useRejectFarmerQuantityRequest,
  type FarmerQuantityRequest,
  type QuantityChangeSource,
} from "@workspace/api-client-react";
import { Camera, CheckCircle2, Clock3, History, Phone, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const statusStyles = {
  pending: "border-straw bg-straw/35 text-straw-foreground",
  approved: "border-primary/25 bg-primary/10 text-primary",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
} as const;

function formatTonnes(value: number) {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)} t`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export function FarmerQuantityPanel({ canDecide, currentUserId }: { canDecide: boolean; currentUserId: number }) {
  const queryClient = useQueryClient();
  const farmerKey = getListFarmerSuppliersQueryKey();
  const requestKey = getListFarmerQuantityRequestsQueryKey();
  const { data: farmers = [], isLoading: farmersLoading } = useListFarmerSuppliers({ query: { queryKey: farmerKey, retry: false } });
  const { data: requests = [], isLoading: requestsLoading } = useListFarmerQuantityRequests({ query: { queryKey: requestKey, retry: false } });
  const [farmerId, setFarmerId] = useState("");
  const [additionalTonnes, setAdditionalTonnes] = useState("");
  const [source, setSource] = useState<QuantityChangeSource>("revised_estimate");
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<{ data: string; mimeType: "image/jpeg" | "image/png" } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [reviewing, setReviewing] = useState<FarmerQuantityRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: farmerKey }),
      queryClient.invalidateQueries({ queryKey: requestKey }),
    ]);
  };
  const create = useCreateFarmerQuantityRequest({ mutation: { onSuccess: async () => {
    await refresh();
    setAdditionalTonnes(""); setReason(""); setPhoto(null); setPhotoError("");
  } } });
  const approve = useApproveFarmerQuantityRequest({ mutation: { onSuccess: async () => { await refresh(); setReviewing(null); setDecisionNote(""); } } });
  const reject = useRejectFarmerQuantityRequest({ mutation: { onSuccess: async () => { await refresh(); setReviewing(null); setDecisionNote(""); } } });

  const selectedFarmer = farmers.find((farmer) => farmer.id === Number(farmerId));
  const pending = requests.filter((request) => request.status === "pending").length;
  const approvedTonnes = requests.filter((request) => request.status === "approved").reduce((sum, request) => sum + request.additionalTonnes, 0);
  const ordered = useMemo(() => [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [requests]);

  async function preparePhoto(file?: File) {
    setPhoto(null); setPhotoError("");
    if (!file) return;
    if (file.size > 2_097_152) return setPhotoError("Photo must be 2 MB or smaller");
    if (file.type !== "image/jpeg" && file.type !== "image/png") return setPhotoError("Use a JPG or PNG photo");
    const data = await new Promise<string>((resolve, rejectRead) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => rejectRead(reader.error);
      reader.readAsDataURL(file);
    });
    setPhoto({ data, mimeType: file.type });
  }

  async function viewPhoto(requestId: number) {
    const evidence = await getFarmerQuantityRequestPhoto(requestId);
    const link = document.createElement("a");
    link.href = `data:${evidence.mimeType};base64,${evidence.fileDataBase64}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }

  function submitRequest() {
    const tonnes = Number(additionalTonnes);
    if (!farmerId || !Number.isFinite(tonnes) || tonnes <= 0 || reason.trim().length < 3) return;
    create.mutate({ data: {
      farmerId: Number(farmerId), additionalTonnes: tonnes, source, reason: reason.trim(),
      fieldPhotoDataBase64: photo?.data ?? null, fieldPhotoMimeType: photo?.mimeType ?? null,
    } });
  }

  if (farmersLoading || requestsLoading) return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading farmer quantity records…</div>;

  return <div>
    <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-3">
      <Summary icon={<Phone />} label="Assigned farmers" value={String(farmers.length)} />
      <Summary icon={<Clock3 />} label="Pending approval" value={String(pending)} />
      <Summary icon={<CheckCircle2 />} label="Approved additions" value={formatTonnes(approvedTonnes)} />
    </div>

    <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
      <section className="border-b border-border p-5 lg:border-b-0 lg:border-r">
        <p className="eyebrow">Phone-assisted update</p>
        <h3 className="mt-2 font-display text-2xl">Add more stubble</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Use this after a farmer calls about additional land, a new field or a revised estimate. The farmer does not need to log in.</p>
        {farmers.length === 0 ? <p className="mt-6 rounded-md bg-secondary p-4 text-sm text-muted-foreground">No approved farmers are assigned to you.</p> : <div className="mt-6 space-y-4">
          <label className="block text-xs font-medium">Farmer
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={farmerId} onChange={(event) => setFarmerId(event.target.value)}>
              <option value="">Choose farmer</option>
              {farmers.map((farmer) => <option key={farmer.id} value={farmer.id}>{farmer.name} · {farmer.clusterName} · {formatTonnes(farmer.listedTonnes)}</option>)}
            </select>
          </label>
          {selectedFarmer && <div className="rounded-md bg-secondary/60 p-3 text-xs"><p className="font-medium">Current listing: {formatTonnes(selectedFarmer.listedTonnes)}</p><p className="mt-1 text-muted-foreground">{selectedFarmer.phone} · {selectedFarmer.clusterName}, {selectedFarmer.district}</p></div>}
          <label className="block text-xs font-medium">Additional tonnes<Input className="mt-1" type="number" min="0.1" step="0.1" value={additionalTonnes} onChange={(event) => setAdditionalTonnes(event.target.value)} placeholder="5" /></label>
          <label className="block text-xs font-medium">Why is the quantity increasing?
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={source} onChange={(event) => setSource(event.target.value as QuantityChangeSource)}>
              <option value="revised_estimate">Revised estimate</option><option value="additional_land">Additional land</option><option value="new_field">New field</option>
            </select>
          </label>
          <label className="block text-xs font-medium">Operator note<Textarea className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Farmer called; 5 additional tonnes expected from adjoining field…" /></label>
          <label className="block rounded-md border border-dashed border-border p-3 text-xs font-medium"><span className="flex items-center gap-2"><Camera className="h-4 w-4" /> Geotagged field photo (optional)</span><Input className="mt-2" type="file" accept="image/jpeg,image/png" onChange={(event) => void preparePhoto(event.target.files?.[0])} />{photo && <span className="mt-2 block text-primary">Photo ready</span>}{photoError && <span className="mt-2 block text-destructive">{photoError}</span>}</label>
          {selectedFarmer && additionalTonnes && Number(additionalTonnes) > 0 && <p className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm">Requested total: <strong>{formatTonnes(selectedFarmer.listedTonnes + Number(additionalTonnes))}</strong></p>}
          <Button className="w-full" disabled={create.isPending || !farmerId || Number(additionalTonnes) <= 0 || reason.trim().length < 3} onClick={submitRequest}><Plus className="mr-2 h-4 w-4" /> Submit increase request</Button>
          {create.isError && <p className="text-sm text-destructive">{(create.error as { data?: { message?: string } }).data?.message ?? "Unable to create request."}</p>}
        </div>}
      </section>

      <section className="p-5">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Audit history</p><h3 className="mt-2 font-display text-2xl">Quantity requests</h3></div><History className="h-5 w-5 text-primary" /></div>
        {ordered.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">No quantity changes have been requested.</p> : <div className="mt-5 space-y-3">{ordered.map((request) => <article key={request.id} className="rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{request.farmerName}</p><p className="mt-1 text-xs text-muted-foreground">{request.farmerPhone} · requested by {request.requestedByName}</p></div><span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-medium capitalize ${statusStyles[request.status]}`}>{request.status}</span></div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-secondary/55 p-3 text-center"><div><p className="text-[0.65rem] text-muted-foreground">Previous</p><p className="mt-1 text-sm font-medium">{formatTonnes(request.previousTonnes)}</p></div><div><p className="text-[0.65rem] text-muted-foreground">Added</p><p className="mt-1 text-sm font-medium text-primary">+{formatTonnes(request.additionalTonnes)}</p></div><div><p className="text-[0.65rem] text-muted-foreground">Requested total</p><p className="mt-1 text-sm font-medium">{formatTonnes(request.requestedTotalTonnes)}</p></div></div>
          <p className="mt-3 text-sm"><span className="capitalize text-muted-foreground">{request.source.replaceAll("_", " ")}:</span> {request.reason}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{formatDate(request.createdAt)}</span><div className="flex gap-2">{request.hasFieldPhoto && <Button size="sm" variant="outline" onClick={() => void viewPhoto(request.id)}>View field photo</Button>}{canDecide && request.status === "pending" && <Button size="sm" variant="outline" onClick={() => { setReviewing(request); setDecisionNote(""); }}>Review</Button>}</div></div>
          {request.reviewedByName && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{request.status === "approved" ? "Approved" : "Rejected"} by {request.reviewedByName}{request.reviewNotes ? ` · ${request.reviewNotes}` : ""}</p>}
        </article>)}</div>}
      </section>
    </div>

    {reviewing && <div className="border-t border-border bg-secondary/35 p-5"><div className="mx-auto max-w-xl"><p className="eyebrow">Coordinator decision</p><h3 className="mt-2 font-display text-2xl">Review {reviewing.farmerName}: +{formatTonnes(reviewing.additionalTonnes)}</h3>{reviewing.requestedByUserId === currentUserId ? <p className="mt-4 rounded-md border border-straw bg-straw/35 p-4 text-sm text-straw-foreground">You submitted this request, so another coordinator or admin must decide it.</p> : <><label className="mt-4 block text-xs font-medium">Decision note<Textarea className="mt-1" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Evidence checked, capacity confirmed…" /></label><div className="mt-4 flex gap-3"><Button className="flex-1" disabled={approve.isPending} onClick={() => approve.mutate({ requestId: reviewing.id, data: { reviewNotes: decisionNote || null } })}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve</Button><Button className="flex-1" variant="outline" disabled={reject.isPending || decisionNote.trim().length < 3} onClick={() => reject.mutate({ requestId: reviewing.id, data: { reason: decisionNote } })}><XCircle className="mr-2 h-4 w-4" /> Reject</Button></div></>}<Button className="mt-3 w-full" variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button></div></div>}
  </div>;
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-md bg-secondary/60 px-4 py-3"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span></div><p className="mt-1 font-display text-2xl">{value}</p></div>;
}
