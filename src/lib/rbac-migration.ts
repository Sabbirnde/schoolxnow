/**
 * Component Migration Guide & Utilities
 * 
 * This file provides utilities to help migrate from hardcoded role checks
 * to the new RBAC system using useFeatureAccess()
 */

import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UserRole } from '@/lib/access-control';

/**
 * Migration Helper: Convert role checks to feature checks
 * 
 * BEFORE (Hardcoded):
 * ```
 * const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin';
 * ```
 * 
 * AFTER (Feature-based):
 * ```
 * const isAdmin = canFull('teachers.create');
 * ```
 */
export function useRoleBasedAccess() {
  const { profile } = useAuth();
  const { is, can } = useFeatureAccess();

  return {
    // Legacy role checks (for gradual migration)
    isSuperAdmin: is('super_admin'),
    isSchoolAdmin: is('school_admin'),
    isTeacher: is('teacher'),
    isStudent: is('student'),
    isGuardian: is('guardian'),

    // New feature-based checks (preferred)
    canManageSchools: can('schools.manage', 'full'),
    canManageUsers: can('users.create', 'full'),
    canManageTeachers: can('teachers.create', 'full'),
    canManageStudents: can('students.create', 'full'),
    canManageClasses: can('classes.create', 'full'),
    canManageSubjects: can('subjects.create', 'full'),
    canRecordAttendance: can('attendance.record', 'full'),
    canEnterMarks: can('marks.enter', 'full'),
    canViewAnalytics: can('analytics.view', 'read-only'),
    canExportData: can('analytics.export', 'full'),

    // Combined checks
    isAdministrator: is(['super_admin', 'school_admin']),
    canEditContent: can('exams.create', 'full') || can('assignments.create', 'full'),
  };
}

/**
 * Component Permission Checker
 * Use this in components to check what the current user can do
 */
export const componentPermissions = {
  /**
   * Check if current user should see administration panels
   */
  shouldShowAdminPanel: () => {
    const { is } = useFeatureAccess();
    return is(['super_admin', 'school_admin']);
  },

  /**
   * Check if current user should see teacher tools
   */
  shouldShowTeacherTools: () => {
    const { can } = useFeatureAccess();
    return can('attendance.record', 'full') || can('marks.enter', 'full');
  },

  /**
   * Check if current user should see student personal data
   */
  shouldShowStudentDashboard: () => {
    const { can } = useFeatureAccess();
    return can('analytics.view_own', 'full');
  },
};

/**
 * Migration Checklist for Components
 * 
 * When updating a component to use RBAC:
 * 
 * 1. Remove: const isAdmin = profile?.role === 'admin';
 * 2. Add:    const { can, is } = useFeatureAccess();
 * 3. Replace: if (isAdmin) with if (can('feature.name', 'full'))
 * 4. Remove: import { useAuth } if only used for role checks
 * 5. Test:   Verify with different user roles
 * 
 * Benefit: Centralized permission management, easier to audit, consistent UX
 */

export const migrationChecklist = [
  '✓ Replace hardcoded role checks with useFeatureAccess()',
  '✓ Use can() for read-only checks, canFull() for write operations',
  '✓ Wrap conditional UI with <FeatureGuard> or <ConditionalUI>',
  '✓ Disable buttons with <AccessControlButton>',
  '✓ Test component with all applicable roles',
  '✓ Update error messages to use DisabledFeatureMessage',
];

/**
 * Pattern Examples for Common Scenarios
 */
export const patterns = {
  /**
   * Show admin panel only to admins
   */
  adminPanelPattern: `
    import { FeatureGuard } from '@/components/FeatureGuard';
    
    export function AdminPanel() {
      return (
        <FeatureGuard feature="system_settings.manage" fallback={<Unauthorized />}>
          {/* Admin content */}
        </FeatureGuard>
      );
    }
  `,

  /**
   * Show/hide buttons based on permission
   */
  conditionalButtonPattern: `
    import { AccessControlButton } from '@/components/FeatureGuard';
    
    export function StudentActions({ studentId }) {
      return (
        <AccessControlButton
          feature="students.delete"
          requiredLevel="full"
          onClick={() => deleteStudent(studentId)}
        >
          Delete Student
        </AccessControlButton>
      );
    }
  `,

  /**
   * Role-specific component rendering
   */
  roleSpecificPattern: `
    import { useFeatureAccess } from '@/hooks/useFeatureAccess';
    
    export function Dashboard() {
      const { is } = useFeatureAccess();
      
      if (is('super_admin')) return <SuperAdminDashboard />;
      if (is('school_admin')) return <AdminDashboard />;
      if (is('teacher')) return <TeacherDashboard />;
      if (is('student')) return <StudentDashboard />;
      return <GuardianDashboard />;
    }
  `,

  /**
   * Progressive disclosure based on features
   */
  progressiveDisclosurePattern: `
    import { ConditionalUI } from '@/components/FeatureGuard';
    
    export function ClassSettings() {
      return (
        <div>
          <BasicSettings />
          
          <ConditionalUI for="classes.edit">
            <AdvancedSettings />
          </ConditionalUI>
          
          <ConditionalUI for="classes.delete">
            <DangerZone />
          </ConditionalUI>
        </div>
      );
    }
  `,
};
