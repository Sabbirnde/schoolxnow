import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useErrorTelemetry } from '@/contexts/ErrorTelemetryContext';

/**
 * Component that observes auth state and updates error telemetry context
 * This ensures error telemetry has user information for better debugging
 */
export function ErrorTelemetryInitializer() {
  const { profile, user } = useAuth();
  const { setErrorContext, addBreadcrumb } = useErrorTelemetry();

  useEffect(() => {
    if (profile && user) {
      // Update telemetry context with user information
      setErrorContext({
        userId: user.id,
        userRole: profile.role,
        schoolId: profile.school_id,
        sessionId: user.id, // Use user ID as session identifier
      });

      // Log user login for troubleshooting
      addBreadcrumb(
        `User logged in: ${profile.full_name} (${profile.role})`,
        'info'
      );
    } else if (profile === null) {
      // User logged out
      addBreadcrumb('User logged out', 'info');
      
      // Clear user context
      setErrorContext({
        userId: undefined,
        userRole: undefined,
        schoolId: undefined,
      });
    }
  }, [profile, user, setErrorContext, addBreadcrumb]);

  return null; // This component doesn't render anything
}
