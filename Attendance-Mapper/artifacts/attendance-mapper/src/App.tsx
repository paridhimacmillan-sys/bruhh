import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AdminProvider } from "@/contexts/admin-context";
import Dashboard from "@/pages/dashboard";
import Attendance from "@/pages/attendance";
import AttendanceSheet from "@/pages/attendance-sheet";
import Employees from "@/pages/employees";
import EmployeeDetail from "@/pages/employee-detail";
import Departments from "@/pages/admin/departments";
import Overtime from "@/pages/admin/overtime";
import Leaves from "@/pages/admin/leaves";
import Payroll from "@/pages/payroll";
import Form12 from "@/pages/form-12";
import DailyReport from "@/pages/admin/reports/daily";
import MonthlyReport from "@/pages/admin/reports/monthly";
import AbsenteeismReport from "@/pages/admin/reports/absenteeism";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/sheet" component={AttendanceSheet} />
        <Route path="/employees" component={Employees} />
        <Route path="/employees/:employeeId" component={EmployeeDetail} />

        <Route path="/departments" component={Departments} />
        <Route path="/overtime" component={Overtime} />
        <Route path="/leaves" component={Leaves} />
        <Route path="/payroll" component={Payroll} />
        <Route path="/form-12" component={Form12} />
        <Route path="/reports/daily" component={DailyReport} />
        <Route path="/reports/monthly" component={MonthlyReport} />
        <Route path="/reports/absenteeism" component={AbsenteeismReport} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AdminProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
