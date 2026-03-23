/**
 * RBAC Testing Utilities
 * 
 * Tools for testing feature access across all user roles
 * Use these to verify access control is working correctly
 */

import { hasFeatureAccess, FEATURE_ACCESS_MATRIX, UserRole } from '@/lib/access-control';

/**
 * Test configuration for verifying RBAC implementation
 */

interface RoleTestCase {
  role: UserRole;
  shouldHave: string[]; // Features this role should access
  shouldNotHave: string[]; // Features this role should NOT access
}

/**
 * Default test cases for each role
 * These verify the feature distribution matrix is correctly implemented
 */
export const defaultTestCases: RoleTestCase[] = [
  {
    role: 'super_admin',
    shouldHave: [
      'schools.create',
      'schools.manage',
      'school_admins.view',
      'school_admins.create',
      'audit_logs.view',
      'system_settings.manage',
    ],
    shouldNotHave: [
      'marks.enter', // Teachers enter marks
      'attendance.record', // Teachers record attendance
    ],
  },
  {
    role: 'school_admin',
    shouldHave: [
      'teachers.create',
      'teachers.approve',
      'students.create',
      'students.enroll',
      'classes.create',
      'subjects.create',
      'attendance.view',
      'marks.approve',
    ],
    shouldNotHave: [
      'schools.create', // Only super admin
      'school_admins.view',
      'system_settings.manage',
      'marks.enter', // Teachers enter marks
    ],
  },
  {
    role: 'teacher',
    shouldHave: [
      'attendance.record',
      'marks.enter',
      'exams.create',
      'analytics.view',
      'reports.create',
      'classes.my_classes',
    ],
    shouldNotHave: [
      'schools.view',
      'teachers.create',
      'students.create',
      'system_settings.manage',
      'audit_logs.view',
    ],
  },
  {
    role: 'student',
    shouldHave: [
      'profile.view',
      'profile.edit',
      'classes.view',
      'marks.view_own',
      'attendance.view_own',
      'analytics.view_own',
    ],
    shouldNotHave: [
      'marks.enter',
      'attendance.record',
      'students.create',
      'settings.school',
      'systems_settings.manage',
    ],
  },
  {
    role: 'guardian',
    shouldHave: [
      'students.view_children',
      'marks.view_children',
      'attendance.view_children',
      'analytics.view_children',
      'settings.profile',
    ],
    shouldNotHave: [
      'marks.enter',
      'attendance.record',
      'students.create',
      'schools.view',
      'system_settings.manage',
    ],
  },
];

/**
 * Run all test cases and report results
 */
export function runAllTests(): { passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  defaultTestCases.forEach((testCase) => {
    const { shouldPass, shouldFail } = runTestCase(testCase);
    results.push({ testCase, shouldPass, shouldFail });

    if (shouldPass.length > 0) failed += shouldPass.length;
    else passed++;

    if (shouldFail.length > 0) failed += shouldFail.length;
    else passed++;
  });

  return { passed, failed, results };
}

interface TestResult {
  testCase: RoleTestCase;
  shouldPass: string[]; // Features that should have access but don't
  shouldFail: string[]; // Features that should NOT have access but do
}

/**
 * Run a single test case
 */
function runTestCase(testCase: RoleTestCase): { shouldPass: string[]; shouldFail: string[] } {
  const shouldPass: string[] = [];
  const shouldFail: string[] = [];

  // Check features that should be accessible
  testCase.shouldHave.forEach((feature) => {
    if (!hasFeatureAccess(testCase.role, feature, 'read-only')) {
      shouldPass.push(feature);
    }
  });

  // Check features that should NOT be accessible
  testCase.shouldNotHave.forEach((feature) => {
    if (hasFeatureAccess(testCase.role, feature, 'read-only')) {
      shouldFail.push(feature);
    }
  });

  return { shouldPass, shouldFail };
}

/**
 * Get access summary for all roles
 */
export function generateAccessSummary() {
  const summary: Record<UserRole, { full: number; readOnly: number; none: number }> = {
    super_admin: { full: 0, readOnly: 0, none: 0 },
    school_admin: { full: 0, readOnly: 0, none: 0 },
    teacher: { full: 0, readOnly: 0, none: 0 },
    student: { full: 0, readOnly: 0, none: 0 },
    guardian: { full: 0, readOnly: 0, none: 0 },
  };

  Object.entries(FEATURE_ACCESS_MATRIX).forEach(([role, matrix]) => {
    Object.values(matrix).forEach((access) => {
      if (access === 'full') summary[role as UserRole].full++;
      else if (access === 'read-only') summary[role as UserRole].readOnly++;
      else summary[role as UserRole].none++;
    });
  });

  return summary;
}

/**
 * Verify feature has been properly configured in matrix
 */
export function verifyFeatureConfiguration(feature: string): {
  configured: boolean;
  byRole: Record<UserRole, string>;
} {
  const byRole: Record<UserRole, string> = {
    super_admin: FEATURE_ACCESS_MATRIX.super_admin[feature] || 'none',
    school_admin: FEATURE_ACCESS_MATRIX.school_admin[feature] || 'none',
    teacher: FEATURE_ACCESS_MATRIX.teacher[feature] || 'none',
    student: FEATURE_ACCESS_MATRIX.student[feature] || 'none',
    guardian: FEATURE_ACCESS_MATRIX.guardian[feature] || 'none',
  };

  const configured = Object.values(byRole).some((access) => access !== 'none');

  return { configured, byRole };
}

/**
 * Export test report as JSON
 */
export function exportTestReport() {
  const summary = generateAccessSummary();
  const allTests = runAllTests();

  return {
    timestamp: new Date().toISOString(),
    totalPassed: allTests.passed,
    totalFailed: allTests.failed,
    accessSummary: summary,
    detailedResults: allTests.results.map((result) => ({
      role: result.testCase.role,
      missingAccess: result.shouldPass,
      unexpectedAccess: result.shouldFail,
      success: result.shouldPass.length === 0 && result.shouldFail.length === 0,
    })),
  };
}

/**
 * Utility to log test results in a readable format
 */
export function logTestResults(verbose = false) {
  console.group('🔐 RBAC Test Results');

  const results = runAllTests();
  console.log(`✅ Passed: ${results.passed} |  ❌ Failed: ${results.failed}`);

  if (verbose) {
    results.results.forEach((result) => {
      console.group(`Role: ${result.testCase.role}`);

      if (result.shouldPass.length > 0) {
        console.error('❌ Missing expected access:', result.shouldPass);
      }

      if (result.shouldFail.length > 0) {
        console.error('❌ Unexpected access:', result.shouldFail);
      }

      if (result.shouldPass.length === 0 && result.shouldFail.length === 0) {
        console.log('✅ All checks passed');
      }

      console.groupEnd();
    });
  }

  console.log('\nAccess Summary:');
  const summary = generateAccessSummary();
  Object.entries(summary).forEach(([role, counts]) => {
    console.log(`${role}: ${counts.full} full, ${counts.readOnly} read-only, ${counts.none} none`);
  });

  console.groupEnd();
}

/**
 * Interactive role testing function
 * Call in browser console: testRoleAccess('teacher')
 */
export function testRoleAccess(role: UserRole) {
  console.group(`Testing access for ${role}`);

  const testCase = defaultTestCases.find((tc) => tc.role === role);
  if (!testCase) {
    console.error(`No test case found for role: ${role}`);
    console.groupEnd();
    return;
  }

  console.log('Should have access to:');
  testCase.shouldHave.forEach((feature) => {
    const hasAccess = hasFeatureAccess(role, feature, 'read-only');
    console.log(`  ${hasAccess ? '✅' : '❌'} ${feature}`);
  });

  console.log('\nShould NOT have access to:');
  testCase.shouldNotHave.forEach((feature) => {
    const hasAccess = hasFeatureAccess(role, feature, 'read-only');
    console.log(`  ${!hasAccess ? '✅' : '❌'} ${feature}`);
  });

  console.groupEnd();
}

/**
 * Component for displaying test results in UI
 * 
 * Usage:
 * if (import.meta.env.DEV) {
 *   window.rbacTests = {
 *     testAll: () => logTestResults(true),
 *     testRole: testRoleAccess,
 *     export: exportTestReport,
 *   };
 * }
 */
if ((import.meta as any).env?.DEV) {
  (window as any).rbacDebug = {
    testAll: () => logTestResults(true),
    testRole: testRoleAccess,
    exportReport: exportTestReport,
    generateSummary: generateAccessSummary,
    verify: verifyFeatureConfiguration,
  };
  console.log('🔐 RBAC Debug tools available: window.rbacDebug');
}
