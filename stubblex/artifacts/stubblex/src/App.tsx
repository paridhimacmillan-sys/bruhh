import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { LanguageProvider, PublicLanguageGate } from '@/lib/language';

const Home = lazy(() => import('@/pages/home').then((module) => ({ default: module.Home })));
const PassportPage = lazy(() => import('@/pages/passport').then((module) => ({ default: module.PassportPage })));
const FarmerReceiptPage = lazy(() => import('@/pages/farmer-receipt').then((module) => ({ default: module.FarmerReceiptPage })));
const DispatchPage = lazy(() => import('@/pages/dispatch').then((module) => ({ default: module.DispatchPage })));
const LoginPage = lazy(() => import('@/pages/login').then((module) => ({ default: module.LoginPage })));
const MarketPage = lazy(() => import('@/pages/market').then((module) => ({ default: module.MarketPage })));
const LotDetailPage = lazy(() => import('@/pages/market').then((module) => ({ default: module.LotDetailPage })));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/p/:passportId" component={PassportPage} />
      <Route path="/r/:batchId" component={FarmerReceiptPage} />
      <Route path="/dispatch" component={DispatchPage} />
      <Route path="/market/:lotId" component={LotDetailPage} />
      <Route path="/market" component={MarketPage} />
      <Route path="/login" component={LoginPage} />
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
