import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorTelemetryInitializer } from "@/components/ErrorTelemetryInitializer";
import BootstrapChecker from "@/components/BootstrapChecker";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import Bootstrap from "./pages/Bootstrap";
import SchoolRegistration from "./pages/SchoolRegistration";
import ConfigDebugger from "./pages/ConfigDebugger";
import PasswordReset from "./components/PasswordReset";
import NotFound from "./pages/NotFound";
import TestPage from "./pages/TestPage";
import SupabaseConnectionTest from "./pages/SupabaseConnectionTest";
import RealtimeTest from "./pages/RealtimeTest";
import SupabaseTestSuite from "./pages/SupabaseTestSuite";
import TeacherPortalEntry from "./pages/TeacherPortalEntry";
import { ProtectedRoute } from "./components/FeatureGuard";

// Create a query client with error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Full app with diagnostic routes added
const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorTelemetryInitializer />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/bootstrap" element={<Bootstrap />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/school-registration" element={<SchoolRegistration />} />
              <Route path="/reset-password" element={<PasswordReset />} />
              
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
                  <Route path="/supabase-test" element={<SupabaseConnectionTest />} />
                  <Route path="/realtime-test" element={
                    <React.Suspense fallback={<div>Loading Diagnostic Tool...</div>}>
                      <RealtimeTest />
                    </React.Suspense>
                  } />
                  <Route path="/supabase-test-suite" element={<SupabaseTestSuite />} />
                </>
              )}
              
              {/* Default routes */}
              <Route path="/" element={<Landing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
