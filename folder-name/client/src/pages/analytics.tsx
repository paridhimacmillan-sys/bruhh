import AnalyticsDashboard from "@/pages/analytics-dashboard";

// Project-level analytics page (used in Jira /projects/:id/analytics route)
export default function AnalyticsPage({ projectId }: { projectId: number }) {
  return <AnalyticsDashboard />;
}
