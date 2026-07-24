import { QueryClient } from '@tanstack/react-query';

export type SchoolAdminFilters = Readonly<Record<string, unknown>>;

const stableFilters = (filters: SchoolAdminFilters) =>
  Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

// Optimized React Query client with smart caching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache times optimized for school data patterns
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache (formerly cacheTime)
      
      // Retry configuration
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch configuration
      refetchOnWindowFocus: false, // Don't refetch on every window focus
      refetchOnReconnect: true, // Do refetch when reconnecting
      refetchOnMount: true, // Refetch on component mount if stale
      
      // Network mode
      networkMode: 'online', // Only fetch when online
    },
    mutations: {
      // Retry failed mutations
      retry: 1,
      networkMode: 'online',
    },
  },
});

// Query key factory for consistent cache keys
export const queryKeys = {
  // User & Auth
  userProfile: (userId: string) => ['user-profile', userId] as const,
  userRole: (userId: string) => ['user-role', userId] as const,
  
  // Schools
  schools: () => ['schools'] as const,
  school: (schoolId: string) => ['schools', schoolId] as const,
  schoolSettings: (schoolId: string) => ['school-settings', schoolId] as const,
  
  // Students
  students: (schoolId?: string, classId?: string) => 
    ['students', { schoolId, classId }] as const,
  student: (studentId: string) => ['students', studentId] as const,
  
  // Classes
  classes: (schoolId?: string) => ['classes', { schoolId }] as const,
  class: (classId: string) => ['classes', classId] as const,
  
  // Subjects
  subjects: (classLevel?: string) => ['subjects', { classLevel }] as const,
  subject: (subjectId: string) => ['subjects', subjectId] as const,
  
  // Teachers
  teachers: (schoolId?: string) => ['teachers', { schoolId }] as const,
  teacher: (teacherId: string) => ['teachers', teacherId] as const,
  
  // Attendance
  attendance: (filters: Record<string, unknown>) => ['attendance', filters] as const,
  
  // Exams
  exams: (schoolId?: string, classId?: string) => 
    ['exams', { schoolId, classId }] as const,
  exam: (examId: string) => ['exams', examId] as const,
  examResults: (examId: string) => ['exam-results', examId] as const,
  
  // Timetable
  timetable: (classId?: string, teacherId?: string) => 
    ['timetable', { classId, teacherId }] as const,
  
  // Analytics
  analytics: (type: string, filters: Record<string, unknown>) => 
    ['analytics', type, filters] as const,
  
  // Audit logs
  auditLogs: (filters: Record<string, unknown>) => ['audit-logs', filters] as const,
};

// School-admin keys are deliberately hierarchical. React Query hashes the
// normalized filters deterministically, allowing request deduplication across
// components that ask for the same resource.
export const schoolAdminQueryKeys = {
  all: ['school-admin'] as const,
  school: (schoolId: string) => ['school-admin', schoolId] as const,
  dashboard: (schoolId: string) => ['school-admin', schoolId, 'dashboard'] as const,
  studentsRoot: (schoolId: string) => ['school-admin', schoolId, 'students'] as const,
  students: (schoolId: string, filters: SchoolAdminFilters = {}) =>
    ['school-admin', schoolId, 'students', stableFilters(filters)] as const,
  attendance: (schoolId: string, date: string) =>
    ['school-admin', schoolId, 'attendance', date] as const,
  resource: (schoolId: string, resource: string) =>
    ['school-admin', schoolId, resource] as const,
};

const inferSchoolId = (...values: unknown[]) => {
  for (const value of values) {
    if (value && typeof value === 'object' && 'school_id' in value) {
      const schoolId = (value as { school_id?: unknown }).school_id;
      if (typeof schoolId === 'string' && schoolId) return schoolId;
    }
  }
  return undefined;
};

export async function invalidateSchoolAdminTableMutation(
  table: string,
  ...records: unknown[]
) {
  const schoolId = inferSchoolId(...records);
  await queryClient.invalidateQueries({
    queryKey: schoolId
      ? schoolAdminQueryKeys.resource(schoolId, table)
      : schoolAdminQueryKeys.all,
    predicate: schoolId
      ? undefined
      : (query) => query.queryKey[0] === 'school-admin' && query.queryKey[2] === table,
  });
}

type StudentMutation = 'create' | 'update' | 'delete';
type StudentLike = {
  school_id?: unknown;
  status?: unknown;
};
type DashboardLike = {
  stats?: {
    totalStudents?: number;
    activeStudents?: number;
  };
};

export function optimisticallyUpdateStudentCounts(
  operation: StudentMutation,
  next?: StudentLike,
  previous?: StudentLike,
) {
  const schoolId = inferSchoolId(next, previous);
  const snapshots: Array<{ queryKey: readonly unknown[]; data: unknown }> = [];
  const dashboards = queryClient.getQueriesData<DashboardLike>({
    predicate: (query) =>
      query.queryKey[0] === 'school-admin' &&
      query.queryKey[2] === 'dashboard' &&
      (!schoolId || query.queryKey[1] === schoolId),
  });

  const activeDelta =
    operation === 'create'
      ? (next?.status === 'active' ? 1 : 0)
      : operation === 'delete'
        ? (previous?.status === 'active' ? -1 : 0)
        : Number(next?.status === 'active') - Number(previous?.status === 'active');
  const totalDelta = operation === 'create' ? 1 : operation === 'delete' ? -1 : 0;

  for (const [queryKey, data] of dashboards) {
    if (!data?.stats) continue;
    snapshots.push({ queryKey, data });
    queryClient.setQueryData<DashboardLike>(queryKey, {
      ...data,
      stats: {
        ...data.stats,
        totalStudents: Math.max(0, Number(data.stats.totalStudents || 0) + totalDelta),
        activeStudents: Math.max(0, Number(data.stats.activeStudents || 0) + activeDelta),
      },
    });
  }

  return () => {
    for (const snapshot of snapshots) {
      queryClient.setQueryData(snapshot.queryKey, snapshot.data);
    }
  };
}

// Cache time presets for different data types
export const cacheConfig = {
  dashboard: {
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
  },
  // Static/rarely changing data - cache longer
  static: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  },
  
  // Semi-static data (school settings, subjects) - medium cache
  semiStatic: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  
  // Dynamic data (attendance, grades) - shorter cache
  dynamic: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  
  // Real-time data - minimal cache
  realtime: {
    staleTime: 0, // Always stale, refetch immediately
    gcTime: 1 * 60 * 1000, // 1 minute
  },
};
