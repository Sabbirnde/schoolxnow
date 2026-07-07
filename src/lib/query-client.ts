import { QueryClient } from '@tanstack/react-query';

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

// Cache time presets for different data types
export const cacheConfig = {
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
