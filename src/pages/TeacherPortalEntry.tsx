import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * TeacherPortalEntry - Auto-login page for teachers
 * 
 * Features:
 * 1. Magic link auto-login (recovery via URL fragment)
 * 2. Session token restoration
 * 3. Auto-redirect for authenticated teachers
 * 4. Loading states and error handling
 */

const TeacherPortalEntry = () => {
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAutoLogin = async () => {
      try {
        setIsProcessing(true);
        setError(null);

        // Check if there's a session recovery token in URL fragment
        const fragment = window.location.hash;
        
        if (fragment && fragment.includes('access_token')) {
          // Supabase automatically handles URL fragments with access_token
          // The onAuthStateChange listener in AuthProvider will pick it up
          console.log('[TeacherPortal] Magic link detected, session will restore...');
          
          // Wait for auth to update
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Check if user is already authenticated via localStorage session
        if (!user && !session && !fragment) {
          // Try to restore session from localStorage
          const { data, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('[TeacherPortal] Session restore error:', sessionError);
            setError('Unable to restore session. Please log in.');
          } else if (!data.session) {
            console.log('[TeacherPortal] No existing session found, redirecting to login');
            setError(null); // Clear error for redirect
          }
        }

        setIsProcessing(false);
      } catch (err) {
        console.error('[TeacherPortal] Auto-login error:', err);
        setError(err instanceof Error ? err.message : 'Auto-login failed');
        setIsProcessing(false);
      }
    };

    if (!authLoading) {
      handleAutoLogin();
    }
  }, [user, session, authLoading, toast]);

  // Redirect authenticated teachers to dashboard
  if (user && session && !isProcessing) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show loading state while processing
  if (isProcessing || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-secondary/5">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Verifying Teacher Portal Access</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {error ? 'Session verification in progress...' : 'Authenticating your session...'}
          </p>
        </div>
      </div>
    );
  }

  // If no user/session and no error, redirect to login
  if (!user && !error) {
    return <Navigate to="/auth" replace />;
  }

  // Show error state with redirect option
  if (error && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-secondary/5 px-4">
        <div className="bg-card border border-border rounded-lg p-6 md:p-8 max-w-md w-full text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Session Verification Failed</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">You will be redirected to login in 3 seconds...</p>
          
          <script>{`
            setTimeout(() => {
              window.location.href = '/auth?redirect=teacher-portal';
            }, 3000);
          `}</script>
        </div>
      </div>
    );
  }

  // Fallback: display page is loading
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/5">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

export default TeacherPortalEntry;
