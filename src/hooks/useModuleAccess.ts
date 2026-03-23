/**
 * Module Access Control Hook
 * Provides module-level access validation for dashboard modules
 */

import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import {
  getModuleConfig,
  getModulesByRole,
  isModuleAccessibleByRole,
  MODULE_REGISTRY,
} from "@/lib/module-config";
import type { ModuleConfig } from "@/lib/module-config";

interface ModuleAccessCheck {
  canAccess: boolean;
  reason?: string;
  feature: string;
  requiredLevel: string;
}

/**
 * Hook for checking module-level access control
 * Combines role-based and feature-based access validation
 */
export function useModuleAccess() {
  const { profile } = useAuth();
  const { canFull, can } = useFeatureAccess();
  const role = profile?.role;

  /**
   * Check if the current user can access a specific module
   */
  const canAccessModule = useCallback(
    (moduleId: string): ModuleAccessCheck => {
      if (!role) {
        return {
          canAccess: false,
          reason: "User not authenticated",
          feature: "",
          requiredLevel: "",
        };
      }

      const module = getModuleConfig(moduleId);

      if (!module) {
        return {
          canAccess: false,
          reason: `Module "${moduleId}" not found`,
          feature: "",
          requiredLevel: "",
        };
      }

      // Check role-based access first
      if (!module.allowedRoles.includes(role)) {
        return {
          canAccess: false,
          reason: `Module "${module.title}" is not available for ${role}s`,
          feature: module.feature,
          requiredLevel: module.requiredLevel,
        };
      }

      // Check feature-based access
      const hasAccess = can(module.feature, module.requiredLevel);
      if (!hasAccess) {
        return {
          canAccess: false,
          reason: `Insufficient permissions for "${module.title}"`,
          feature: module.feature,
          requiredLevel: module.requiredLevel,
        };
      }

      return {
        canAccess: true,
        feature: module.feature,
        requiredLevel: module.requiredLevel,
      };
    },
    [role, can]
  );

  /**
   * Check if the current user can switch to a module
   * (Wrapper for usability)
   */
  const canSwitchToModule = useCallback(
    (moduleId: string): boolean => {
      const check = canAccessModule(moduleId);
      if (!check.canAccess) {
        console.warn(
          `[Module Access] Denied: ${check.reason || "Unknown reason"}`
        );
      }
      return check.canAccess;
    },
    [canAccessModule]
  );

  /**
   * Get all accessible modules for the current user
   */
  const getAccessibleModules = useCallback((): ModuleConfig[] => {
    if (!role) return [];
    return getModulesByRole(role).filter((module) => {
      const check = canAccessModule(module.id);
      return check.canAccess;
    });
  }, [role, canAccessModule]);

  /**
   * Get accessible modules grouped by category
   */
  const getAccessibleModulesByCategory = useCallback(
    (category: "admin" | "management" | "operations" | "reporting") => {
      return getAccessibleModules().filter(
        (module) => module.category === category
      );
    },
    [getAccessibleModules]
  );

  /**
   * Get module configuration and access status
   */
  const getModuleWithAccessStatus = useCallback(
    (moduleId: string) => {
      const module = getModuleConfig(moduleId);
      if (!module) return null;

      const access = canAccessModule(moduleId);
      return {
        ...module,
        canAccess: access.canAccess,
        accessReason: access.reason,
      };
    },
    [canAccessModule]
  );

  /**
   * Validate module access and log details
   */
  const validateModuleAccess = useCallback(
    (moduleId: string, logDetails = false) => {
      const check = canAccessModule(moduleId);

      if (logDetails) {
        if (check.canAccess) {
          console.log(
            `✅ Module Access Granted: ${moduleId}`,
            `Feature: ${check.feature}`
          );
        } else {
          console.warn(
            `❌ Module Access Denied: ${moduleId}`,
            check.reason ||
              `Feature: ${check.feature}, Required Level: ${check.requiredLevel}`
          );
        }
      }

      return check;
    },
    [canAccessModule]
  );

  // Memoize the return object to ensure stable reference in dependency arrays
  return useMemo(
    () => ({
      // Core functions
      canAccessModule,
      canSwitchToModule,
      getAccessibleModules,
      getAccessibleModulesByCategory,
      getModuleWithAccessStatus,
      validateModuleAccess,

      // Helper getters
      accessibleModuleCount: getAccessibleModules().length,
      currentUserRole: role,
    }),
    [
      canAccessModule,
      canSwitchToModule,
      getAccessibleModules,
      getAccessibleModulesByCategory,
      getModuleWithAccessStatus,
      validateModuleAccess,
      role,
    ]
  );
}

/**
 * Alternative: Simple boolean hook for checking if a module is accessible
 * Usage: const canAccessStudents = useCanAccessModule('students');
 */
export function useCanAccessModule(moduleId: string): boolean {
  const { canSwitchToModule } = useModuleAccess();
  return canSwitchToModule(moduleId);
}
