import { useCallback } from 'react';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useSchoolStats, type SchoolStats } from '@/hooks/useSchoolStats';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { queryKeys } from '@/lib/query-client';

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
  recentActivities: SchoolAdminRecentActivity[];
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
  recentActivities: [],
};

export async function fetchSchoolAdminDashboardData(
  schoolId: string,
  fetchSchoolStats: FetchSchoolStats
): Promise<SchoolAdminDashboardData> {
  if (isPhpBackend) {
    const [school, stats, recentStudents, classes] = await Promise.all([
      phpApi.table<SchoolAdminSchoolInfo & { id: string }>('schools').get(schoolId),
      fetchSchoolStats(schoolId),
      phpApi.table<SchoolAdminRecentActivity>('students').list({
        school_id: schoolId,
        sort: 'admission_date',
        order: 'desc',
        limit: 5,
      }),
      phpApi.table<{ id: string; name: string }>('classes').list({
        school_id: schoolId,
        limit: 200,
      }),
    ]);

    const classById = new Map(classes.map((classItem) => [classItem.id, classItem]));
    const recentActivities = recentStudents.map((student) => ({
      ...student,
      classes: student.class_id ? classById.get(student.class_id) || null : null,
    }));

    return {
      stats,
      schoolInfo: school,
      recentActivities,
    };
  }

  const { data: school, error: schoolError } = await apiClient
    .from('schools')
    .select('name, name_bangla, school_type')
    .eq('id', schoolId)
    .single();

  if (schoolError) throw schoolError;

  const stats = await fetchSchoolStats(schoolId);

  const { data: recentStudents, error: studentsError } = await apiClient
    .from('students')
    .select('full_name, admission_date, class_id, classes(name)')
    .eq('school_id', schoolId)
    .order('admission_date', { ascending: false })
    .limit(5);

  if (studentsError) throw studentsError;

  return {
    stats,
    schoolInfo: school,
    recentActivities: (recentStudents || []) as unknown as SchoolAdminRecentActivity[],
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
    'realtime',
    [...queryKeys.analytics('school-admin-dashboard', { schoolId })],
    queryFn,
    {
      enabled: Boolean(schoolId),
      retry: 2,
    }
  );

  const data = query.data || defaultSchoolAdminDashboardData;

  return {
    ...data,
    loading: Boolean(schoolId) && query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
