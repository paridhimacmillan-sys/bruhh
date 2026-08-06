import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { LanguageProvider, PublicLanguageGate } from '@/lib/language';

const Home = lazy(() => import('@/pages/home').then((module) => ({ default: module.Home })));
const FarmerReceiptPage = lazy(() => import('@/pages/farmer-receipt').then((module) => ({ default: module.FarmerReceiptPage })));
const FarmerDashboardPage = lazy(() => import('@/pages/farmer-dashboard').then((module) => ({ default: module.FarmerDashboardPage })));
const DispatchPage = lazy(() => import('@/pages/dispatch').then((module) => ({ default: module.DispatchPage })));
const LoginPage = lazy(() => import('@/pages/login').then((module) => ({ default: module.LoginPage })));
const MarketPage = lazy(() => import('@/pages/market').then((module) => ({ default: module.MarketPage })));
const LotDetailPage = lazy(() => import('@/pages/market').then((module) => ({ default: module.LotDetailPage })));
const ApplicationStatusPage = lazy(() => import('@/pages/application-status').then((module) => ({ default: module.ApplicationStatusPage })));
const AdminDashboardPage = lazy(() => import('@/pages/admin-dashboard').then((module) => ({ default: module.AdminDashboardPage })));
const InspectorDashboardPage = lazy(() => import('@/pages/inspector-dashboard').then((module) => ({ default: module.InspectorDashboardPage })));
const OperatorDashboardPage = lazy(() => import('@/pages/operator-dashboard').then((module) => ({ default: module.OperatorDashboardPage })));
const AggregatorDashboardPage = lazy(() => import('@/pages/aggregator-dashboard').then((module) => ({ default: module.AggregatorDashboardPage })));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/r/:batchId" component={FarmerReceiptPage} />
      <Route path="/farmer/:token" component={FarmerDashboardPage} />
      <Route path="/dispatch" component={DispatchPage} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/inspector" component={InspectorDashboardPage} />
      <Route path="/operator" component={OperatorDashboardPage} />
      <Route path="/aggregator" component={AggregatorDashboardPage} />
      <Route path="/market/:lotId" component={LotDetailPage} />
      <Route path="/market" component={MarketPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/application-status" component={ApplicationStatusPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <LanguageProvider>
            <PublicLanguageGate>
              <Suspense fallback={<div className="min-h-screen bg-background" />}><Router /></Suspense>
            </PublicLanguageGate>
          </LanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
