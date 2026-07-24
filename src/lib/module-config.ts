/**
 * Dashboard Module Configuration
 * Maps modules to required features and access levels for route protection
 */

import { UserRole, AccessLevel } from "@/lib/access-control";

export interface ModuleConfig {
  id: string;
  name: string;
  title: string;
  description: string;
  feature: string;
  requiredLevel: AccessLevel;
  allowedRoles: UserRole[];
  category: "admin" | "management" | "operations" | "reporting";
}

/**
 * All accessible modules with their feature requirements
 * Used to validate module access before rendering
 */
export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  // Core/Common
  dashboard: {
    id: "dashboard",
    name: "dashboard",
    title: "Dashboard",
    description: "Role-specific dashboard overview",
    feature: "audit_logs.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "admin",
  },

  // Super Admin Modules
  schools: {
    id: "schools",
    name: "schools",
    title: "School Management",
    description: "Manage all schools in the system",
    feature: "schools.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin"],
    category: "admin",
  },
  users: {
    id: "users",
    name: "users",
    title: "User Management",
    description: "Manage system users and admins",
    feature: "school_admins.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin"],
    category: "admin",
  },
  settings: {
    id: "settings",
    name: "settings",
    title: "Settings",
    description: "System and school settings",
    feature: "system_settings.manage",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin"],
    category: "admin",
  },

  // School Admin & Teacher Modules
  students: {
    id: "students",
    name: "students",
    title: "Student Management",
    description: "Manage student information and enrollment",
    feature: "students.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "management",
  },
  classes: {
    id: "classes",
    name: "classes",
    title: "Class Management",
    description: "Manage classes and sections",
    feature: "classes.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "management",
  },
  subjects: {
    id: "subjects",
    name: "subjects",
    title: "Subject Management",
    description: "Manage curriculum subjects",
    feature: "subjects.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "management",
  },

  // Operations Modules
  attendance: {
    id: "attendance",
    name: "attendance",
    title: "Attendance Management",
    description: "Record and manage student attendance",
    feature: "attendance.record",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "operations",
  },
  exams: {
    id: "exams",
    name: "exams",
    title: "Exam Management",
    description: "Create and manage exams",
    feature: "exams.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "operations",
  },
  "exam-marks": {
    id: "exam-marks",
    name: "exam-marks",
    title: "Enter Exam Marks",
    description: "Enter student exam marks",
    feature: "marks.enter",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "operations",
  },
  timetable: {
    id: "timetable",
    name: "timetable",
    title: "Timetable Management",
    description: "Create and manage class timetables",
    feature: "timetable.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "operations",
  },
  "class-assignment": {
    id: "class-assignment",
    name: "class-assignment",
    title: "Class Assignment",
    description: "Assign teachers to classes",
    feature: "classes.view",
    requiredLevel: "full",
    allowedRoles: ["super_admin", "school_admin"],
    category: "management",
  },
  "academic-operations": {
    id: "academic-operations",
    name: "academic-operations",
    title: "Academic Operations",
    description: "Manage admissions, yearly offerings, enrollment, promotion, assessments, and guardian access",
    feature: "students.enroll",
    requiredLevel: "full",
    allowedRoles: ["school_admin"],
    category: "operations",
  },
  billing: {
    id: "billing",
    name: "billing",
    title: "Fees & Billing",
    description: "Configure fees, issue invoices, record payments, and manage balances",
    feature: "students.enroll",
    requiredLevel: "full",
    allowedRoles: ["school_admin"],
    category: "operations",
  },

  // Reporting Modules
  reports: {
    id: "reports",
    name: "reports",
    title: "Reports & Analytics",
    description: "Generate and analyze reports",
    feature: "reports.view",
    requiredLevel: "read-only",
    allowedRoles: ["super_admin", "school_admin", "teacher"],
    category: "reporting",
  },
};

/**
 * Get module configuration by ID
 */
export function getModuleConfig(moduleId: string): ModuleConfig | undefined {
  return MODULE_REGISTRY[moduleId];
}

/**
 * Get all modules accessible by a role
 */
export function getModulesByRole(role: UserRole): ModuleConfig[] {
  return Object.values(MODULE_REGISTRY).filter((module) =>
    module.allowedRoles.includes(role)
  );
}

/**
 * Get modules by category
 */
export function getModulesByCategory(
  category: "admin" | "management" | "operations" | "reporting"
): ModuleConfig[] {
  return Object.values(MODULE_REGISTRY).filter(
    (module) => module.category === category
  );
}

/**
 * Check if a module is accessible by a specific role
 */
export function isModuleAccessibleByRole(
  moduleId: string,
  role: UserRole
): boolean {
  const module = getModuleConfig(moduleId);
  if (!module) return false;
  return module.allowedRoles.includes(role);
}

/**
 * Get all accessible modules for a role and category
 */
export function getModulesByRoleAndCategory(
  role: UserRole,
  category: "admin" | "management" | "operations" | "reporting"
): ModuleConfig[] {
  return Object.values(MODULE_REGISTRY).filter(
    (module) =>
      module.allowedRoles.includes(role) && module.category === category
  );
}
