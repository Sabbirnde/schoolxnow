import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorTelemetryInitializer } from "@/components/ErrorTelemetryInitializer";
import BootstrapChecker from "@/components/BootstrapChecker";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import { ProtectedRoute } from "./components/FeatureGuard";
import { RouteBrandFooter } from "./components/BrandFooter";

const Landing = lazy(() => import("./pages/Landing"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const Bootstrap = lazy(() => import("./pages/Bootstrap"));
const SchoolRegistration = lazy(() => import("./pages/SchoolRegistration"));
const ConfigDebugger = lazy(() => import("./pages/ConfigDebugger"));
const PasswordReset = lazy(() => import("./components/PasswordReset"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TestPage = lazy(() => import("./pages/TestPage"));
const RealtimeTest = lazy(() => import("./pages/RealtimeTest"));
const TeacherPortalEntry = lazy(() => import("./pages/TeacherPortalEntry"));
const GuardianInvitation = lazy(() => import("./pages/GuardianInvitation"));

const RouteLoadingFallback = () => (
  <div
    aria-label="Loading page"
    className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"
    role="status"
  >
    Loading…
  </div>
);

// Full app with diagnostic routes added
const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <ErrorTelemetryInitializer />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/bootstrap" element={<Bootstrap />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/school-registration" element={<SchoolRegistration />} />
              <Route path="/reset-password" element={<PasswordReset />} />
              <Route path="/guardian-invitation" element={
                <ProtectedRoute roles="guardian" redirectTo="/auth">
                  <GuardianInvitation />
                </ProtectedRoute>
              } />

              {/* Teacher auto-login portal - Protected for teachers only */}
              <Route path="/teacher-portal" element={
                <ProtectedRoute roles="teacher" redirectTo="/dashboard">
                  <TeacherPortalEntry />
                </ProtectedRoute>
              } />

              {/* Admin-only routes - Protected for super admin only */}
              <Route path="/system-admin-access" element={
                <ProtectedRoute roles="super_admin" redirectTo="/dashboard">
                  <AdminAuth />
                </ProtectedRoute>
              } />

              {/* Main dashboard (role-based navigation inside) */}
              <Route path="/dashboard" element={
                <BootstrapChecker>
                  <Index />
                </BootstrapChecker>
              } />

              {/* Debug & diagnostic routes (dev only) */}
              {import.meta.env.DEV && (
                <>
                  <Route path="/config-debug" element={<ConfigDebugger />} />
                  <Route path="/test" element={<TestPage />} />
                  <Route path="/realtime-test" element={<RealtimeTest />} />
                </>
              )}

              {/* Default routes */}
              <Route path="/" element={<Landing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <RouteBrandFooter />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
