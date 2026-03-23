import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { AccessLevel, UserRole } from '@/lib/access-control';

interface FeatureGuardProps {
  feature: string;
  requiredLevel?: AccessLevel;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component wrapper for feature-based access control
 * 
 * Usage:
 * <FeatureGuard feature="exams.create" requiredLevel="full">
 *   <ExamCreationForm />
 * </FeatureGuard>
 */
export function FeatureGuard({
  feature,
  requiredLevel = 'read-only',
  children,
  fallback = null,
}: FeatureGuardProps) {
  const { can } = useFeatureAccess();

  if (!can(feature, requiredLevel)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGuardProps {
  roles: UserRole | UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component wrapper for role-based access control
 * 
 * Usage:
 * <RoleGuard roles={['super_admin', 'school_admin']}>
 *   <AdminPanel />
 * </RoleGuard>
 */
export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { profile } = useAuth();
  const userRole = profile?.role as UserRole;
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  if (!requiredRoles.includes(userRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ProtectedRouteProps {
  feature?: string;
  roles?: UserRole | UserRole[];
  requiredLevel?: AccessLevel;
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Route protection wrapper
 * 
 * Usage:
 * <Route path="/exams/create" element={
 *   <ProtectedRoute feature="exams.create" requiredLevel="full">
 *     <ExamCreationPage />
 *   </ProtectedRoute>
 * } />
 */
export function ProtectedRoute({
  feature,
  roles,
  requiredLevel = 'read-only',
  children,
  redirectTo = '/dashboard',
}: ProtectedRouteProps) {
  const { profile, loading } = useAuth();
  const { can } = useFeatureAccess();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!profile) {
    return <Navigate to="/auth" replace />;
  }

  // Check role if specified
  if (roles) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    if (!requiredRoles.includes(profile.role as UserRole)) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  // Check feature if specified
  if (feature && !can(feature, requiredLevel)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

interface DisabledFeatureMessageProps {
  feature: string;
  userRole: UserRole;
}

/**
 * Display message for disabled features
 */
export function DisabledFeatureMessage({ feature, userRole }: DisabledFeatureMessageProps) {
  const roleNames: Record<UserRole, string> = {
    super_admin: 'System Administrator',
    school_admin: 'School Administrator',
    teacher: 'Teacher',
    student: 'Student',
    guardian: 'Guardian',
  };

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
      <p className="font-medium">Access Restricted</p>
      <p className="mt-1">
        This feature is not available for {roleNames[userRole]} accounts. Please contact your
        administrator if you believe this is incorrect.
      </p>
    </div>
  );
}

interface FeatureAvailabilityBadgeProps {
  feature: string;
  className?: string;
}

/**
 * Badge showing availability by role
 */
export function FeatureAvailabilityBadge({ feature, className = '' }: FeatureAvailabilityBadgeProps) {
  const { profile } = useAuth();
  const { can } = useFeatureAccess();
  const userRole = (profile?.role ?? 'student') as UserRole;

  if (!can(feature)) {
    return (
      <span className={`inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 ${className}`}>
        Not Available
      </span>
    );
  }

  return (
    <span className={`inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-600 ${className}`}>
      Available
    </span>
  );
}

interface ConditionalUIProps {
  for: string | string[];
  requiredLevel?: AccessLevel;
  children: React.ReactNode;
  elseShow?: React.ReactNode;
}

/**
 * Conditionally render UI based on feature access
 * 
 * Shorthand for FeatureGuard
 */
export function ConditionalUI({ for: features, requiredLevel = 'read-only', children, elseShow }: ConditionalUIProps) {
  const { can } = useFeatureAccess();
  const featureList = Array.isArray(features) ? features : [features];
  const hasAccess = featureList.some((f) => can(f, requiredLevel));

  return <>{hasAccess ? children : elseShow}</>;
}

interface AccessControlButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  feature: string;
  requiredLevel?: AccessLevel;
  disabledTooltip?: string;
  children: React.ReactNode;
}

/**
 * Button that automatically disables based on feature access
 */
export const AccessControlButton = React.forwardRef<HTMLButtonElement, AccessControlButtonProps>(
  ({ feature, requiredLevel = 'full', disabledTooltip, disabled: propDisabled, ...props }, ref) => {
    const { can } = useFeatureAccess();
    const hasAccess = can(feature, requiredLevel);
    const disabled = !hasAccess || propDisabled;

    return (
      <button
        ref={ref}
        disabled={disabled}
        title={!hasAccess ? disabledTooltip || 'You do not have permission for this action' : undefined}
        className={!hasAccess ? 'opacity-50 cursor-not-allowed' : ''}
        {...props}
      />
    );
  }
);

AccessControlButton.displayName = 'AccessControlButton';

interface AccessControlItemProps {
  feature: string;
  requiredLevel?: AccessLevel;
  className?: string;
  disabledClassName?: string;
  children: React.ReactNode;
}

/**
 * Generic container that hides/disables content based on access
 */
export function AccessControlItem({
  feature,
  requiredLevel = 'read-only',
  className = '',
  disabledClassName = 'opacity-50 pointer-events-none',
  children,
}: AccessControlItemProps) {
  const { can } = useFeatureAccess();
  const hasAccess = can(feature, requiredLevel);

  return (
    <div className={hasAccess ? className : disabledClassName}>
      {children}
    </div>
  );
}
