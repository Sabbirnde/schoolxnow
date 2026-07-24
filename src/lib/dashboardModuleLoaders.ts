type UserRole = "super_admin" | "school_admin" | "teacher" | string | null | undefined;

export const dashboardModuleLoaders = {
  students: () => import("@/components/StudentManagement"),
  classes: () => import("@/components/ClassManagement"),
  subjects: () => import("@/components/SubjectManagement"),
  attendance: () => import("@/components/AttendanceManagement"),
  exams: () => import("@/components/ExamManagement"),
  timetable: () => import("@/components/TimetableManagement"),
  schoolAdmins: () => import("@/components/SchoolAdminManagement"),
  teachers: () => import("@/components/TeacherManagement"),
  schools: () => import("@/components/SchoolManagement"),
  settings: () => import("@/components/Settings"),
  examMarks: () => import("@/components/ExamMarksEntry"),
  schoolAdminReports: () => import("@/components/SchoolAdminReportsDashboard"),
  superAdminReports: () => import("@/components/SuperAdminReportsDashboard"),
  teacherReports: () => import("@/components/TeacherPerformanceReports"),
  classAssignment: () => import("@/components/ClassAssignment"),
  academicOperations: () => import("@/components/AcademicOperations"),
  billing: () => import("@/components/BillingManagement"),
} as const;

const modulePreloaders: Record<string, (role: UserRole) => Promise<unknown> | undefined> = {
  students: () => dashboardModuleLoaders.students(),
  classes: () => dashboardModuleLoaders.classes(),
  subjects: () => dashboardModuleLoaders.subjects(),
  attendance: () => dashboardModuleLoaders.attendance(),
  exams: () => dashboardModuleLoaders.exams(),
  timetable: () => dashboardModuleLoaders.timetable(),
  schools: () => dashboardModuleLoaders.schools(),
  settings: () => dashboardModuleLoaders.settings(),
  "exam-marks": () => dashboardModuleLoaders.examMarks(),
  "teacher-reports": () => dashboardModuleLoaders.teacherReports(),
  "class-assignment": () => dashboardModuleLoaders.classAssignment(),
  "academic-operations": () => dashboardModuleLoaders.academicOperations(),
  billing: () => dashboardModuleLoaders.billing(),
  users: (role) =>
    role === "super_admin"
      ? dashboardModuleLoaders.schoolAdmins()
      : dashboardModuleLoaders.teachers(),
  reports: (role) =>
    role === "super_admin"
      ? dashboardModuleLoaders.superAdminReports()
      : role === "school_admin"
        ? dashboardModuleLoaders.schoolAdminReports()
        : undefined,
};

export const preloadDashboardModule = (moduleId: string, role: UserRole) => {
  // Dynamic imports are cached by the browser, so repeated hover/focus events
  // reuse the same request and React.lazy receives the already-loaded module.
  void modulePreloaders[moduleId]?.(role)?.catch(() => {
    // Navigation remains the retry path if an intent-based preload fails.
  });
};
