import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "sonner";
import { useMe } from "./hooks/useMe";

import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import ProductionEntryPage from "./pages/ProductionEntry";
import MastersPage from "./pages/Masters";
import UsersPage from "./pages/Users";
import RecentEntriesPage from "./pages/RecentEntries";
import ReportsPage from "./pages/Reports";
import AlertsPage from "./pages/Alerts";
import AppLayout from "./components/layout/AppLayout";

function ProtectedRoutes() {
  const { user, loading } = useMe();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Redirect to="/login" />;
  const isOperator = user.role === "employee";

  return (
    <AppLayout user={user}>
      <Switch>
        <Route path="/production-entry" component={ProductionEntryPage} />
        {!isOperator && <Route path="/" component={DashboardPage} />}
        {!isOperator && <Route path="/masters" component={MastersPage} />}
        {!isOperator && <Route path="/users" component={UsersPage} />}
        {!isOperator && <Route path="/recent" component={RecentEntriesPage} />}
        {!isOperator && <Route path="/reports" component={ReportsPage} />}
        {!isOperator && <Route path="/alerts" component={AlertsPage} />}
        <Route>
          <Redirect to={isOperator ? "/production-entry" : "/"} />
        </Route>
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route>
            <ProtectedRoutes />
          </Route>
        </Switch>
      </Router>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
