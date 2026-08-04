import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOnboardingApplicationsQueryKey,
  getListOnboardingClustersQueryKey,
  getListFieldOperatorsQueryKey,
  getListOnboardingApplicationDocumentsQueryKey,
  getListOnboardingApplicationHistoryQueryKey,
  getListOnboardingApplicationInspectionsQueryKey,
  useApproveOnboardingApplication,
  useListOnboardingApplications,
  useListOnboardingApplicationDocuments,
  useListOnboardingApplicationHistory,
  useListOnboardingApplicationInspections,
  useCreateOnboardingApplicationInspection,
  useUploadOnboardingApplicationDocument,
  useListOnboardingClusters,
  useListFieldOperators,
  useRejectOnboardingApplication,
  useUpdateOnboardingApplicationStatus,
  type OnboardingApplication,
  type OnboardingApplicantType,
  type OnboardingStatus,
  type OnboardingStatusUpdateStatus,
  type OnboardingDocument,
  type OnboardingEvent,
  type OnboardingDocumentUpload,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const applicantLabels: Record<OnboardingApplicantType, string> = {
  farmer: "Farmer / FPO",
  machine_partner: "Machine partner",
  logistics_operator: "Logistics operator",
  buyer: "Industrial buyer",
};

const statusStyles: Record<OnboardingStatus, string> = {
  new: "border-straw bg-straw/45 text-straw-foreground",
  contacted: "border-border bg-secondary text-foreground",
  documents_pending: "border-straw bg-straw/30 text-straw-foreground",
  verified: "border-primary/25 bg-primary/10 text-primary",
  approved: "border-primary bg-primary text-primary-foreground",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  waitlisted: "border-border bg-muted text-muted-foreground",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function displayValue(key: string, value: string | number | null): string {
  if (value == null || value === "") return "—";
  if (key === "machineType") return String(value).replaceAll("_", " ");
  if (key === "expectedTonnes") return `${value} t`;
  if (key === "serviceRadiusKm") return `${value} km`;
  if (key === "acres") return `${value} acres`;
  return String(value);
}

function labelForKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function OnboardingPanel({ canDecide }: { canDecide: boolean }) {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<"all" | OnboardingApplicantType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OnboardingStatus>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusterId, setClusterId] = useState<string>("");
  const [operatorId, setOperatorId] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const queryKey = getListOnboardingApplicationsQueryKey();
  const { data: applications = [], isLoading, error } = useListOnboardingApplications({ query: { queryKey, retry: false } });
  const { data: clusters = [] } = useListOnboardingClusters({ query: { queryKey: getListOnboardingClustersQueryKey(), retry: false } });
  const { data: operators = [] } = useListFieldOperators({ query: { queryKey: getListFieldOperatorsQueryKey(), retry: false } });
  const { data: documents = [] } = useListOnboardingApplicationDocuments(selectedId ?? 0, { query: { queryKey: getListOnboardingApplicationDocumentsQueryKey(selectedId ?? 0), enabled: selectedId !== null, retry: false } });
  const { data: history = [] } = useListOnboardingApplicationHistory(selectedId ?? 0, { query: { queryKey: getListOnboardingApplicationHistoryQueryKey(selectedId ?? 0), enabled: selectedId !== null, retry: false } });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey }); };
  const updateStatus = useUpdateOnboardingApplicationStatus({ mutation: { onSuccess: refresh } });
  const approve = useApproveOnboardingApplication({ mutation: { onSuccess: async () => { await refresh(); setReviewNotes(""); } } });
  const reject = useRejectOnboardingApplication({ mutation: { onSuccess: async () => { await refresh(); setRejectionReason(""); } } });

  const selected = applications.find((application) => application.id === selectedId) ?? null;
  const filtered = useMemo(() => applications.filter((application) =>
    (typeFilter === "all" || application.applicantType === typeFilter) &&
    (statusFilter === "all" || application.status === statusFilter),
  ), [applications, statusFilter, typeFilter]);

  const counts = {
    new: applications.filter((application) => application.status === "new").length,
    verification: applications.filter((application) => application.status === "contacted" || application.status === "documents_pending" || application.status === "verified").length,
    approved: applications.filter((application) => application.status === "approved").length,
  };

  const markStatus = (status: OnboardingStatusUpdateStatus) => {
    if (!selected) return;
    updateStatus.mutate({ applicationId: selected.id, data: { status, reviewNotes: reviewNotes || null } });
  };

  if (isLoading) return <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading onboarding applications…</div>;
  if (error) return <div className="px-6 py-16 text-center text-sm text-destructive">Unable to load onboarding applications.</div>;

  return (
    <div>
      <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-3">
        <Summary label="New applications" value={counts.new} />
        <Summary label="In verification" value={counts.verification} />
        <Summary label="Approved" value={counts.approved} />
      </div>

      <div className="flex flex-wrap gap-3 border-b border-border p-5">
        <label className="text-xs text-muted-foreground">Applicant type
          <select className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
            <option value="all">All applicants</option>
            {Object.entries(applicantLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Status
          <select className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            {(["new", "contacted", "documents_pending", "verified", "approved", "rejected", "waitlisted"] as const).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="overflow-x-auto border-b border-border lg:border-b-0 lg:border-r">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead><tr className="border-b border-border bg-secondary/70">{["Applicant", "Type", "District", "Applied", "Status"].map((heading) => <th key={heading} className="px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">{heading}</th>)}</tr></thead>
            <tbody>{filtered.map((application) => (
              <tr key={application.id} onClick={() => { setSelectedId(application.id); setClusterId(""); setOperatorId(""); setReviewNotes(application.reviewNotes ?? ""); setRejectionReason(""); }} className={`cursor-pointer border-b border-border/70 last:border-0 hover:bg-secondary/45 ${selectedId === application.id ? "bg-primary/5" : ""}`}>
                <td className="px-5 py-4"><p className="text-sm font-medium">{application.name}</p><p className="mt-1 text-xs text-muted-foreground">{application.phone}</p></td>
                <td className="px-5 py-4 text-sm text-muted-foreground">{applicantLabels[application.applicantType]}</td>
                <td className="px-5 py-4 text-sm text-muted-foreground">{application.district}</td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">{formatDate(application.appliedAt)}</td>
                <td className="px-5 py-4"><StatusChip status={application.status} /></td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <div className="px-6 py-16 text-center text-sm text-muted-foreground">No applications match these filters.</div>}
        </div>

        <aside className="p-5">
          {!selected ? <div className="py-12 text-center"><p className="font-display text-xl">Select an application</p><p className="mt-2 text-sm text-muted-foreground">Review details and record the Unpackos decision here.</p></div> : <ReviewApplication
            application={selected}
            canDecide={canDecide}
            documents={documents}
            history={history}
            clusters={clusters}
            operators={operators}
            clusterId={clusterId}
            setClusterId={setClusterId}
            operatorId={operatorId}
            setOperatorId={setOperatorId}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
            rejectionReason={rejectionReason}
            setRejectionReason={setRejectionReason}
            onStatus={markStatus}
            onApprove={() => approve.mutate({ applicationId: selected.id, data: { assignedClusterId: clusterId ? Number(clusterId) : null, assignedOperatorId: operatorId ? Number(operatorId) : null, reviewNotes: reviewNotes || null } })}
            onReject={() => reject.mutate({ applicationId: selected.id, data: { reason: rejectionReason } })}
            pending={updateStatus.isPending || approve.isPending || reject.isPending}
          />}
        </aside>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-secondary/60 px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>;
}

function StatusChip({ status }: { status: OnboardingStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-medium capitalize ${statusStyles[status]}`}>{status.replaceAll("_", " ")}</span>;
}

function ReviewApplication({ application, canDecide, documents, history, clusters, operators, clusterId, setClusterId, operatorId, setOperatorId, reviewNotes, setReviewNotes, rejectionReason, setRejectionReason, onStatus, onApprove, onReject, pending }: {
  application: OnboardingApplication;
  canDecide: boolean;
  documents: OnboardingDocument[];
  history: OnboardingEvent[];
  clusters: Array<{ id: number; name: string; district: string; acres: number }>;
  operators: Array<{ id: number; name: string; phone: string }>;
  clusterId: string;
  setClusterId: (value: string) => void;
  operatorId: string;
  setOperatorId: (value: string) => void;
  reviewNotes: string;
  setReviewNotes: (value: string) => void;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  onStatus: (status: OnboardingStatusUpdateStatus) => void;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  const decided = application.status === "approved" || application.status === "rejected";
  return <div>
    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Application #{application.id}</p><h3 className="mt-2 font-display text-2xl">{application.name}</h3><p className="mt-1 text-sm text-muted-foreground">{applicantLabels[application.applicantType]} · {application.phone}</p></div><StatusChip status={application.status} /></div>
    <dl className="mt-5 divide-y divide-border border-y border-border text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Reference</dt><dd className="font-mono">{application.reference}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Phone verification</dt><dd className="text-primary">Verified</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">District</dt><dd>{application.district}</dd></div>{Object.entries(application.applicationData).map(([key, value]) => <div key={key} className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{labelForKey(key)}</dt><dd className="text-right capitalize">{displayValue(key, value)}</dd></div>)}</dl>
    <div className="mt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Verification documents · {documents.length}</p>{documents.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No documents submitted.</p> : <div className="mt-2 space-y-2">{documents.map((document) => <a key={document.id} download={document.fileName} href={`data:${document.mimeType};base64,${document.fileDataBase64}`} className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"><span className="font-medium">{document.fileName}</span><span className="block text-xs text-muted-foreground">{document.documentType.replaceAll("_", " ")} · {Math.ceil(document.sizeBytes / 1024)} KB</span></a>)}</div>}</div>
    {!decided && <>
      <div className="mt-5 grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => onStatus("contacted")} disabled={pending}>Contacted</Button><Button size="sm" variant="outline" onClick={() => onStatus("documents_pending")} disabled={pending}>Request documents</Button><Button size="sm" variant="outline" onClick={() => onStatus("verified")} disabled={pending}>Mark verified</Button>{canDecide && <Button size="sm" variant="outline" onClick={() => onStatus("waitlisted")} disabled={pending}>Waitlist</Button>}</div>
      {canDecide && application.applicantType === "farmer" && <label className="mt-5 block text-xs text-muted-foreground">Assign cluster<select className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={clusterId} onChange={(event) => setClusterId(event.target.value)}><option value="">Choose cluster before approval</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name} · {cluster.district}</option>)}</select></label>}
      {canDecide && application.applicantType === "farmer" && <label className="mt-4 block text-xs text-muted-foreground">Assign field operator<select className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={operatorId} onChange={(event) => setOperatorId(event.target.value)}><option value="">Choose operator before approval</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name} · {operator.phone}</option>)}</select></label>}
      <label className="mt-4 block text-xs text-muted-foreground">Internal review notes<Textarea className="mt-1" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Verification call, documents checked, operating area…" /></label>
      {canDecide && <><Button className="mt-4 w-full" disabled={pending || (application.applicantType === "farmer" && (!clusterId || !operatorId))} onClick={onApprove}>Approve application</Button>
      <label className="mt-5 block text-xs text-muted-foreground">Rejection reason<Input className="mt-1" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Required before rejection" /></label>
      <Button className="mt-2 w-full" variant="outline" disabled={pending || rejectionReason.trim().length < 3} onClick={onReject}>Reject application</Button></>}
    </>}
    <InspectionWorkspace applicationId={application.id} />
    {decided && <div className="mt-5 rounded-md border border-border bg-secondary/50 p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Decision record</p><p className="mt-2 text-sm">{application.reviewNotes || "No review note recorded."}</p>{application.reviewedAt && <p className="mt-2 text-xs text-muted-foreground">Reviewed {formatDate(application.reviewedAt)}</p>}</div>}
    <div className="mt-5 border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Audit history</p>{history.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No recorded activity.</p> : <ol className="mt-3 space-y-3">{history.map((event) => <li key={event.id} className="border-l-2 border-primary/25 pl-3"><p className="text-sm font-medium capitalize">{event.action.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{event.actorName || "Public applicant"} · {formatDate(event.createdAt)}</p>{event.note && <p className="mt-1 text-xs">{event.note}</p>}</li>)}</ol>}</div>
  </div>;
}

function InspectionWorkspace({ applicationId }: { applicationId: number }) {
  const queryClient = useQueryClient();
  const inspectionsKey = getListOnboardingApplicationInspectionsQueryKey(applicationId);
  const { data: inspections = [] } = useListOnboardingApplicationInspections(applicationId, { query: { queryKey: inspectionsKey, retry: false } });
  const [visitedAt, setVisitedAt] = useState(new Date().toISOString().slice(0, 16));
  const [observedAcres, setObservedAcres] = useState("");
  const [estimatedTonnes, setEstimatedTonnes] = useState("");
  const [fieldLocation, setFieldLocation] = useState("");
  const [fieldNotes, setFieldNotes] = useState("");
  const [recommendation, setRecommendation] = useState<"recommended" | "revisit_required" | "not_eligible">("recommended");
  const [documentType, setDocumentType] = useState("field_inspection_report");
  const [document, setDocument] = useState<OnboardingDocumentUpload | null>(null);
  const refresh = async () => { await queryClient.invalidateQueries(); };
  const createInspection = useCreateOnboardingApplicationInspection({ mutation: { onSuccess: async () => { await refresh(); setFieldNotes(""); } } });
  const uploadDocument = useUploadOnboardingApplicationDocument({ mutation: { onSuccess: async () => { await refresh(); setDocument(null); } } });

  async function prepareDocument(file: File | undefined) {
    if (!file) return setDocument(null);
    if (file.size > 2_097_152 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return setDocument(null);
    const fileDataBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    setDocument({ documentType, fileName: file.name, mimeType: file.type as OnboardingDocumentUpload["mimeType"], sizeBytes: file.size, fileDataBase64 });
  }

  const canSubmit = Boolean(visitedAt && Number(observedAcres) > 0 && Number(estimatedTonnes) > 0 && fieldLocation.trim().length >= 2 && fieldNotes.trim().length >= 3);
  return <div className="mt-6 border-t border-border pt-5">
    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Field inspection · inspector workspace</p>
    {inspections.length > 0 && <div className="mt-3 space-y-2">{inspections.map((inspection) => <div key={inspection.id} className="rounded-md border border-border bg-secondary/45 p-3"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{inspection.inspectorName}</p><span className="text-xs capitalize text-primary">{inspection.recommendation.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(inspection.visitedAt)} · {inspection.observedAcres} acres · {inspection.estimatedTonnes} t estimated</p><p className="mt-2 text-xs">{inspection.fieldLocation} — {inspection.fieldNotes}</p></div>)}</div>}
    <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs text-muted-foreground">Visit date<Input className="mt-1" type="datetime-local" value={visitedAt} onChange={(event) => setVisitedAt(event.target.value)} /></label><label className="text-xs text-muted-foreground">Field location<Input className="mt-1" value={fieldLocation} onChange={(event) => setFieldLocation(event.target.value)} placeholder="Village / field reference" /></label><label className="text-xs text-muted-foreground">Observed acres<Input className="mt-1" type="number" value={observedAcres} onChange={(event) => setObservedAcres(event.target.value)} /></label><label className="text-xs text-muted-foreground">Estimated tonnes<Input className="mt-1" type="number" value={estimatedTonnes} onChange={(event) => setEstimatedTonnes(event.target.value)} /></label></div>
    <label className="mt-3 block text-xs text-muted-foreground">Inspector field notes<Textarea className="mt-1" value={fieldNotes} onChange={(event) => setFieldNotes(event.target.value)} placeholder="Access, crop residue observed, machinery suitability, farmer confirmation…" /></label>
    <label className="mt-3 block text-xs text-muted-foreground">Recommendation<select className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={recommendation} onChange={(event) => setRecommendation(event.target.value as typeof recommendation)}><option value="recommended">Recommended</option><option value="revisit_required">Revisit required</option><option value="not_eligible">Not eligible</option></select></label>
    <Button type="button" variant="outline" className="mt-3 w-full" disabled={!canSubmit || createInspection.isPending} onClick={() => createInspection.mutate({ applicationId, data: { visitedAt: new Date(visitedAt).toISOString(), observedAcres: Number(observedAcres), estimatedTonnes: Number(estimatedTonnes), fieldLocation: fieldLocation.trim(), fieldNotes: fieldNotes.trim(), recommendation } })}>Record field inspection</Button>
    <div className="mt-4 rounded-md border border-dashed border-border p-3"><label className="text-xs text-muted-foreground">Inspector document type<Input className="mt-1" value={documentType} onChange={(event) => { setDocumentType(event.target.value); setDocument(null); }} /></label><Input className="mt-2" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => void prepareDocument(event.target.files?.[0])} /><Button type="button" size="sm" className="mt-2 w-full" disabled={!document || uploadDocument.isPending} onClick={() => document && uploadDocument.mutate({ applicationId, data: { ...document, documentType } })}>Upload inspector document</Button><p className="mt-2 text-[0.65rem] text-muted-foreground">PDF/JPG/PNG · maximum 2 MB · visible only to authorized Unpackos staff</p></div>
  </div>;
}
