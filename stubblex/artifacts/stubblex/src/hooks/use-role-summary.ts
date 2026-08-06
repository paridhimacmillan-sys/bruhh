import { useEffect, useState } from "react";
import { staffApi, type RoleDashboardSummary } from "@/lib/staff-api";

export function useRoleSummary() {
  const [data, setData] = useState<RoleDashboardSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { staffApi.summary().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard")); }, []);
  return { data, error };
}
