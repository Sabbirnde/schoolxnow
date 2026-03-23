import { useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasFeatureAccess, getFeatureAccessLevel, AccessLevel, UserRole } from '@/lib/access-control';

/**
 * Hook to check feature access in React components
 * 
 * Usage:
 * const { can, level, accessible } = useFeatureAccess();
 * 
 * if (can('exams.create')) {
 *   // Show exam creation UI
 * }
 */
export function useFeatureAccess() {
  const { profile } = useAuth();
  
  const role = (profile?.role ?? 'student') as UserRole;

  // Memoize the can function to ensure stable reference
  const can = useCallback((feature: string, requiredLevel: AccessLevel = 'read-only') => {
    return hasFeatureAccess(role, feature, requiredLevel);
  }, [role]);

  // Memoize the level function
  const level = useCallback((feature: string) => {
    return getFeatureAccessLevel(role, feature);
  }, [role]);

  // Memoize the canFull function
  const canFull = useCallback((feature: string) => {
    return hasFeatureAccess(role, feature, 'full');
  }, [role]);

  // Memoize the canView function
  const canView = useCallback((feature: string) => {
    return hasFeatureAccess(role, feature, 'read-only');
  }, [role]);

  // Memoize the is function
  const is = useCallback((checkRole: UserRole | UserRole[]) => {
    const roles = Array.isArray(checkRole) ? checkRole : [checkRole];
    return roles.includes(role);
  }, [role]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      can,
      level,
      canFull,
      canView,
      role,
      is,
    }),
    [can, level, canFull, canView, role, is]
  );
}

/**
 * Hook for sidebar navigation filtering based on access
 */
export function useNavigationAccess() {
  const access = useFeatureAccess();

  // Memoize navigation access methods
  const getVisibleModules = useCallback(
    (modules: Array<{ name: string; feature: string }>) => {
      return modules.filter((m) => access.can(m.feature, 'read-only'));
    },
    [access]
  );

  const isMenuItemVisible = useCallback(
    (feature: string) => {
      return access.can(feature, 'read-only');
    },
    [access]
  );

  const isMenuItemEnabled = useCallback(
    (feature: string) => {
      return access.canFull(feature);
    },
    [access]
  );

  return useMemo(
    () => ({
      getVisibleModules,
      isMenuItemVisible,
      isMenuItemEnabled,
    }),
    [getVisibleModules, isMenuItemVisible, isMenuItemEnabled]
  );
}

/**
 * Hook for enforcing permissions on components
 */
export function useRequireFeature(feature: string, requiredLevel: AccessLevel = 'read-only') {
  const access = useFeatureAccess();

  return useMemo(
    () => ({
      /**
       * Has access to feature
       */
      hasAccess: access.can(feature, requiredLevel),

      /**
       * Should show component (has access)
       */
      shouldShow: access.can(feature, requiredLevel),

      /**
       * Should show disabled state (no access)
       */
      shouldShowDisabled: !access.can(feature, requiredLevel),

      /**
       * Access level
       */
      level: access.level(feature),
    }),
    [access, feature, requiredLevel]
  );
}
