/**
 * Role-Based Access Control (RBAC) System
 * 
 * Implements feature distribution by stakeholder roles
 * defined in the Feature Distribution Matrix
 */

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian';

export type AccessLevel = 'full' | 'read-only' | 'none';

/**
 * Feature permissions for each role
 * 
 * Levels:
 * - 'full': Can create, read, update, delete
 * - 'read-only': Can only view/read
 * - 'none': No access
 */
export const FEATURE_ACCESS_MATRIX: Record<UserRole, Record<string, AccessLevel>> = {
  super_admin: {
    // User Management
    'users.view': 'full',
    'users.create': 'full',
    'users.edit': 'full',
    'users.delete': 'full',
    
    // School Management
    'schools.view': 'full',
    'schools.create': 'full',
    'schools.edit': 'full',
    'schools.delete': 'full',
    
    // School Admin Management
    'school_admins.view': 'full',
    'school_admins.create': 'full',
    'school_admins.edit': 'full',
    'school_admins.delete': 'full',
    'school_admins.approve': 'full',
    'school_admins.reject': 'full',
    
    // Teacher Management
    'teachers.view': 'read-only',
    'teachers.manage': 'none', // Delegated to school admin
    
    // Student Management
    'students.view': 'read-only',
    'students.manage': 'none', // Delegated to school admin
    
    // Class Management
    'classes.view': 'read-only',
    'classes.manage': 'none',
    
    // Subject Management
    'subjects.view': 'read-only',
    'subjects.manage': 'none',
    
    // Attendance
    'attendance.view': 'read-only',
    'attendance.record': 'none',
    
    // Exams & Marks
    'exams.view': 'read-only',
    'exams.manage': 'none',
    'marks.enter': 'none',
    
    // Timetable
    'timetable.view': 'read-only',
    'timetable.manage': 'none',
    
    // Performance Analytics
    'analytics.view': 'full',
    'analytics.export': 'full',
    
    // Reports
    'reports.view': 'full',
    'reports.create': 'full',
    'reports.export': 'full',
    
    // Audit & Security
    'audit_logs.view': 'full',
    'security.manage': 'full',
    'notifications.manage': 'full',
    'system_settings.manage': 'full',
  },

  school_admin: {
    // User Management
    'users.view': 'full',
    'users.create': 'full',
    'users.edit': 'full',
    'users.delete': 'full',
    
    // School Management
    'schools.view': 'full',
    'schools.create': 'none',
    'schools.edit': 'full',
    'schools.delete': 'none',
    
    // Teacher Management
    'teachers.view': 'full',
    'teachers.create': 'full',
    'teachers.edit': 'full',
    'teachers.delete': 'full',
    'teachers.approve': 'full',
    'teachers.reject': 'full',
    'teachers.assign_classes': 'full',
    
    // Student Management
    'students.view': 'full',
    'students.create': 'full',
    'students.edit': 'full',
    'students.delete': 'full',
    'students.enroll': 'full',
    'students.export': 'full',
    
    // Class Management
    'classes.view': 'full',
    'classes.create': 'full',
    'classes.edit': 'full',
    'classes.delete': 'full',
    
    // Subject Management
    'subjects.view': 'full',
    'subjects.create': 'full',
    'subjects.edit': 'full',
    'subjects.delete': 'full',
    
    // Attendance
    'attendance.view': 'full',
    'attendance.record': 'none', // Teachers record
    'attendance.approve': 'full',
    'attendance.export': 'full',
    
    // Exams & Marks
    'exams.view': 'full',
    'exams.create': 'full',
    'exams.edit': 'full',
    'exams.manage': 'full',
    'marks.view': 'full',
    'marks.enter': 'none', // Teachers enter
    'marks.approve': 'full',
    'marks.export': 'full',
    
    // Timetable
    'timetable.view': 'full',
    'timetable.create': 'full',
    'timetable.edit': 'full',
    'timetable.manage': 'full',
    
    // Performance Analytics
    'analytics.view': 'full',
    'analytics.export': 'full',
    'analytics.by_class': 'full',
    'analytics.by_subject': 'full',
    'analytics.by_teacher': 'full',
    
    // Reports
    'reports.view': 'full',
    'reports.create': 'full',
    'reports.export': 'full',
    'reports.export_students': 'full',
    
    // Notifications
    'notifications.send': 'full',
    'notifications.manage': 'full',
    
    // Settings
    'settings.school': 'full',
    'settings.notification': 'full',
    'settings.security': 'full',
  },

  teacher: {
    // Student Management
    'students.view': 'read-only',
    'students.manage': 'none',
    
    // Subject Management
    'subjects.view': 'read-only',
    'subjects.assign': 'full', // Can assign to classes
    
    // Attendance
    'attendance.view': 'full',
    'attendance.record': 'full', // Primary responsibility
    'attendance.export': 'full',
    'attendance.bulk_edit': 'full',
    
    // Exams & Marks
    'exams.view': 'full',
    'exams.create': 'full',
    'exams.by_subject': 'full',
    'marks.enter': 'full', // Primary responsibility
    'marks.view': 'full',
    'marks.export': 'full',
    'marks.bulk_import': 'full',
    
    // Timetable
    'timetable.view': 'full',
    'timetable.manage': 'none', // Admin delegates
    
    // Class Management
    'classes.view': 'full',
    'classes.my_classes': 'full',
    
    // Performance Analytics
    'analytics.view': 'full',
    'analytics.by_class': 'full',
    'analytics.by_subject': 'full',
    'analytics.export': 'full',
    
    // Reports
    'reports.view': 'full',
    'reports.create': 'full',
    'reports.export': 'full',
    'reports.performance': 'full',
    'reports.student_feedback': 'full',
    
    // Quick Attendance
    'quick_attendance.access': 'full',
    'quick_attendance.mark': 'full',
    
    // Notifications
    'notifications.receive': 'full',
    'notifications.send_to_class': 'full',
    
    // Settings
    'settings.profile': 'full',
    'settings.notification_preference': 'full',
  },

  student: {
    // Personal Data
    'profile.view': 'full',
    'profile.edit': 'full',
    
    // Student Management
    'students.view_self': 'full',
    'students.view_others': 'none',
    
    // Class Management
    'classes.view': 'full',
    'classes.my_schedule': 'full',
    
    // Subject Management
    'subjects.view': 'read-only',
    
    // Attendance
    'attendance.view_own': 'full',
    'attendance.view_records': 'read-only',
    'attendance.record': 'none',
    
    // Exams & Marks
    'exams.view': 'full',
    'exams.view_own_results': 'full',
    'marks.view_own': 'full',
    'marks.enter': 'none',
    
    // Timetable
    'timetable.view': 'full',
    'timetable.my_schedule': 'full',
    
    // Performance Analytics
    'analytics.view_own': 'full',
    'analytics.personal_progress': 'full',
    'analytics.export_own': 'full',
    
    // Reports
    'reports.view_own': 'full',
    'reports.personal_performance': 'full',
    'reports.progress_report': 'full',
    
    // Notifications
    'notifications.receive': 'full',
    'notifications.view': 'full',
    
    // Settings
    'settings.profile': 'full',
    'settings.password': 'full',
    'settings.notification_preference': 'full',
  },

  guardian: {
    // Student Monitoring
    'students.view_children': 'full',
    'students.monitor_progress': 'full',
    
    // Subject Management
    'subjects.view': 'read-only',
    
    // Attendance
    'attendance.view_children': 'full',
    'attendance.record': 'none',
    
    // Exams & Marks
    'exams.view_children': 'full',
    'marks.view_children': 'full',
    'marks.enter': 'none',
    
    // Timetable
    'timetable.view_children': 'full',
    'timetable.my_schedule': 'none', // Not applicable
    
    // Performance Analytics
    'analytics.view_children': 'full',
    'analytics.child_progress': 'full',
    
    // Reports
    'reports.view_children': 'full',
    'reports.child_performance': 'full',
    'reports.progress_report': 'full',
    'reports.export_children': 'full',
    
    // Notifications
    'notifications.receive': 'full',
    'notifications.view': 'full',
    
    // Settings
    'settings.profile': 'full',
    'settings.notification_preference': 'full',
  },
};

/**
 * Check if a user role has access to a feature
 */
export function hasFeatureAccess(role: UserRole, feature: string, requiredLevel: AccessLevel = 'read-only'): boolean {
  const roleMatrix = FEATURE_ACCESS_MATRIX[role];
  
  if (!roleMatrix) {
    console.warn(`[RBAC] Unknown role: ${role}`);
    return false;
  }
  
  const accessLevel = roleMatrix[feature];
  
  if (!accessLevel || accessLevel === 'none') {
    return false;
  }
  
  // Check if current access level meets required level
  if (requiredLevel === 'full') {
    return accessLevel === 'full';
  }
  
  if (requiredLevel === 'read-only') {
    return accessLevel === 'full' || accessLevel === 'read-only';
  }
  
  return true;
}

/**
 * Get access level for a feature
 */
export function getFeatureAccessLevel(role: UserRole, feature: string): AccessLevel {
  const roleMatrix = FEATURE_ACCESS_MATRIX[role];
  return roleMatrix?.[feature] ?? 'none';
}

/**
 * Get all accessible features for a role
 */
export function getAccessibleFeatures(role: UserRole): string[] {
  const roleMatrix = FEATURE_ACCESS_MATRIX[role];
  return Object.entries(roleMatrix)
    .filter(([_, access]) => access !== 'none')
    .map(([feature, _]) => feature);
}

/**
 * Get feature groups for UI navigation
 */
export const featureGroups = {
  usermanagement: ['users.view', 'users.create', 'users.edit', 'users.delete'],
  schoolmanagement: ['schools.view', 'schools.create', 'schools.edit', 'schools.delete'],
  teachermanagement: [
    'teachers.view',
    'teachers.create',
    'teachers.edit',
    'teachers.delete',
    'teachers.approve',
    'teachers.reject',
    'teachers.assign_classes',
  ],
  studentmanagement: [
    'students.view',
    'students.create',
    'students.edit',
    'students.delete',
    'students.enroll',
    'students.export',
  ],
  classmanagement: ['classes.view', 'classes.create', 'classes.edit', 'classes.delete'],
  subjectmanagement: ['subjects.view', 'subjects.create', 'subjects.edit', 'subjects.delete'],
  attendance: ['attendance.view', 'attendance.record', 'attendance.export'],
  exams: ['exams.view', 'exams.create', 'exams.manage', 'marks.enter', 'marks.view'],
  timetable: ['timetable.view', 'timetable.create', 'timetable.manage'],
  analytics: ['analytics.view', 'analytics.export'],
  reports: ['reports.view', 'reports.create', 'reports.export'],
  settings: ['settings.school', 'settings.profile', 'settings.notification_preference'],
};

/**
 * Check if role can access a feature group
 */
export function canAccessFeatureGroup(role: UserRole, group: keyof typeof featureGroups): boolean {
  const features = featureGroups[group];
  return features.some((feature) => hasFeatureAccess(role, feature));
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    super_admin: 'System Administrator',
    school_admin: 'School Administrator',
    teacher: 'Teacher',
    student: 'Student',
    guardian: 'Guardian/Parent',
  };
  return names[role];
}

/**
 * Get role color for UI display
 */
export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    super_admin: 'bg-red-100 text-red-900 border-red-300',
    school_admin: 'bg-orange-100 text-orange-900 border-orange-300',
    teacher: 'bg-teal-100 text-teal-900 border-teal-300',
    student: 'bg-blue-100 text-blue-900 border-blue-300',
    guardian: 'bg-green-100 text-green-900 border-green-300',
  };
  return colors[role];
}

/**
 * Get role icon for UI display
 */
export function getRoleIcon(role: UserRole): string {
  const icons: Record<UserRole, string> = {
    super_admin: '🔐',
    school_admin: '🏫',
    teacher: '👨‍🏫',
    student: '👨‍🎓',
    guardian: '👨‍👩‍👧',
  };
  return icons[role];
}
