import { useCallback } from 'react';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useSchoolStats, type SchoolStats } from '@/hooks/useSchoolStats';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { schoolAdminQueryKeys } from '@/lib/query-client';
import { dashboardRefreshIntervals, pollOnlyWhenVisible } from '@/lib/dashboard-refresh';

export interface SchoolAdminSchoolInfo {
  name: string;
  name_bangla: string | null;
  school_type: string;
}

export interface SchoolAdminRecentActivity {
  full_name: string;
  admission_date: string;
  class_id: string | null;
  classes: {
    name: string;
  } | null;
}

export interface SchoolAdminDashboardData {
  stats: SchoolStats;
  schoolInfo: SchoolAdminSchoolInfo | null;
  recentAdmissions: SchoolAdminRecentActivity[];
  tasks: {
    pendingAttendance: number;
    scheduledExams: number;
    newAdmissions: number;
    pendingApplications: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    timestamp: string;
    success: boolean;
    error_message?: string | null;
    user_id: string;
    metadata?: unknown;
  }>;
}

type FetchSchoolStats = (schoolId: string | null) => Promise<SchoolStats>;

export const defaultSchoolAdminStats: SchoolStats = {
  totalStudents: 0,
  activeStudents: 0,
  totalTeachers: 0,
  totalClasses: 0,
  totalSubjects: 0,
  recentAdmissions: 0,
};

export const defaultSchoolAdminDashboardData: SchoolAdminDashboardData = {
  stats: defaultSchoolAdminStats,
  schoolInfo: null,
  recentAdmissions: [],
  tasks: {
    pendingAttendance: 0,
    scheduledExams: 0,
    newAdmissions: 0,
    pendingApplications: 0,
  },
  recentActivity: [],
};

export async function fetchSchoolAdminDashboardData(
  schoolId: string,
  fetchSchoolStats: FetchSchoolStats
): Promise<SchoolAdminDashboardData> {
  if (isPhpBackend) {
    const dashboard = await phpApi.schoolAdminDashboard(schoolId);
    return {
      stats: dashboard.stats,
      schoolInfo: dashboard.school,
      recentAdmissions: dashboard.recentAdmissions,
      tasks: dashboard.tasks,
      recentActivity: dashboard.recentActivity.map((entry) => ({
        ...entry,
        success: entry.success === true || entry.success === 1,
      })),
    };
  }

  const [schoolResponse, stats, studentsResponse] = await Promise.all([
    apiClient
      .from('schools')
      .select('name, name_bangla, school_type')
      .eq('id', schoolId)
      .single(),
    fetchSchoolStats(schoolId),
    apiClient
      .from('students')
      .select('full_name, admission_date, class_id, classes(name)')
      .eq('school_id', schoolId)
      .order('admission_date', { ascending: false })
      .limit(5),
  ]);

  if (schoolResponse.error) throw schoolResponse.error;
  if (studentsResponse.error) throw studentsResponse.error;

  const school = schoolResponse.data;
  const recentStudents = studentsResponse.data;

  return {
    stats,
    schoolInfo: school,
    recentAdmissions: (recentStudents || []) as unknown as SchoolAdminRecentActivity[],
    tasks: defaultSchoolAdminDashboardData.tasks,
    recentActivity: defaultSchoolAdminDashboardData.recentActivity,
  };
}

export function useSchoolAdminDashboardData(schoolId?: string | null) {
  const fetchSchoolStats = useSchoolStats();
  const queryFn = useCallback(() => {
    if (!schoolId) {
      return Promise.resolve(defaultSchoolAdminDashboardData);
    }

    return fetchSchoolAdminDashboardData(schoolId, fetchSchoolStats);
  }, [fetchSchoolStats, schoolId]);

  const query = useCachedQuery(
    'dashboard',
    schoolAdminQueryKeys.dashboard(schoolId || 'unresolved'),
    queryFn,
    {
      enabled: Boolean(schoolId),
      retry: 2,
      placeholderData: (previousData, previousQuery) =>
        previousQuery?.queryKey[1] === schoolId ? previousData : undefined,
      refetchInterval: pollOnlyWhenVisible(dashboardRefreshIntervals.schoolAdmin),
      refetchIntervalInBackground: false,
    }
  );

  const data = query.data || defaultSchoolAdminDashboardData;

  return {
    ...data,
    loading: Boolean(schoolId) && query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    lastUpdatedAt: query.dataUpdatedAt,
  };
}
