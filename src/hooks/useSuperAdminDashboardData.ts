import { useCachedQuery } from '@/hooks/useCachedQuery';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { queryKeys } from '@/lib/query-client';
import type { Database } from '@/integrations/database/types';
import { dashboardRefreshIntervals } from '@/lib/dashboard-refresh';

export type SuperAdminSchool = Database['public']['Tables']['schools']['Row'];

export interface SuperAdminDashboardStats {
  totalSchools: number;
  activeSchools: number;
  totalSchoolAdmins: number;
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  pendingApplications: number;
  schoolsThisMonth: number;
  studentsThisMonth: number;
  teachersThisMonth: number;
  monthlyGrowth: number;
}

export interface SuperAdminSchoolTypeStats {
  bangla_medium: number;
  english_medium: number;
  madrasha: number;
}

export interface SuperAdminRecentAuditLog {
  id: string;
  action: string;
  entity_type: string;
  timestamp: string;
  success: boolean;
  user_id: string | null;
}

export interface SuperAdminDashboardData {
  schools: SuperAdminSchool[];
  stats: SuperAdminDashboardStats;
  schoolTypeStats: SuperAdminSchoolTypeStats;
  recentActivity: SuperAdminRecentAuditLog[];
}

type CountResponse = {
  count: number | null;
  error: unknown;
};

export const defaultSuperAdminDashboardStats: SuperAdminDashboardStats = {
  totalSchools: 0,
  activeSchools: 0,
  totalSchoolAdmins: 0,
  totalStudents: 0,
  totalTeachers: 0,
  totalClasses: 0,
  totalSubjects: 0,
  pendingApplications: 0,
  schoolsThisMonth: 0,
  studentsThisMonth: 0,
  teachersThisMonth: 0,
  monthlyGrowth: 0,
};

export const defaultSuperAdminSchoolTypeStats: SuperAdminSchoolTypeStats = {
  bangla_medium: 0,
  english_medium: 0,
  madrasha: 0,
};

export const defaultSuperAdminDashboardData: SuperAdminDashboardData = {
  schools: [],
  stats: defaultSuperAdminDashboardStats,
  schoolTypeStats: defaultSuperAdminSchoolTypeStats,
  recentActivity: [],
};

const readCount = (response: CountResponse): number => {
  if (response.error) throw response.error;
  return response.count || 0;
};

const toMysqlDateTime = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

export const calculateSuperAdminMonthlyGrowth = (
  currentMonthSchools: number,
  previousMonthSchools: number
) => {
  if (previousMonthSchools > 0) {
    return Math.round(((currentMonthSchools - previousMonthSchools) / previousMonthSchools) * 100);
  }

  return currentMonthSchools > 0 ? 100 : 0;
};

export const summarizeSchoolTypes = (schools: SuperAdminSchool[]): SuperAdminSchoolTypeStats => ({
  bangla_medium: schools.filter((school) => school.school_type === 'bangla_medium').length,
  english_medium: schools.filter((school) => school.school_type === 'english_medium').length,
  madrasha: schools.filter((school) => school.school_type === 'madrasha').length,
});

export async function fetchSuperAdminDashboardData(): Promise<SuperAdminDashboardData> {
  if (isPhpBackend) {
    const now = new Date();
    const currentMonthStart = toMysqlDateTime(new Date(now.getFullYear(), now.getMonth(), 1));
    const previousMonthStart = toMysqlDateTime(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const [
      schools,
      totalSchools,
      activeSchools,
      students,
      teachers,
      classes,
      subjects,
      pendingApplications,
      schoolAdmins,
      currentMonthSchools,
      currentMonthStudents,
      currentMonthTeachers,
      previousMonthSchools,
      auditLogs,
    ] = await Promise.all([
      phpApi.table<SuperAdminSchool>('schools').list({ sort: 'created_at', order: 'desc', limit: 200 }),
      phpApi.table('schools').count(),
      phpApi.table('schools').count({ is_active: 1 }),
      phpApi.table('students').count(),
      phpApi.table('teachers').count(),
      phpApi.table('classes').count(),
      phpApi.table('subjects').count(),
      phpApi.table('teacher_applications').count({ status: 'pending' }),
      phpApi.table('user_roles').count({ role: 'school_admin' }),
      phpApi.table('schools').count({ created_at__gte: currentMonthStart }),
      phpApi.table('students').count({ created_at__gte: currentMonthStart }),
      phpApi.table('teachers').count({ created_at__gte: currentMonthStart }),
      phpApi.table('schools').count({
        created_at__gte: previousMonthStart,
        created_at__lt: currentMonthStart,
      }),
      phpApi.table<SuperAdminRecentAuditLog>('audit_logs').list({
        sort: 'timestamp',
        order: 'desc',
        limit: 8,
      }),
    ]);

    const normalizedSchools = schools.map((school) => ({
      ...school,
      is_active: Boolean(school.is_active),
    }));
    const currentMonthSchoolCount = currentMonthSchools.count;
    const previousMonthSchoolCount = previousMonthSchools.count;

    return {
      schools: normalizedSchools,
      schoolTypeStats: summarizeSchoolTypes(normalizedSchools),
      recentActivity: auditLogs.map((log) => ({
        ...log,
        success: log.success ?? true,
      })),
      stats: {
        totalSchools: totalSchools.count,
        activeSchools: activeSchools.count,
        totalSchoolAdmins: schoolAdmins.count,
        totalStudents: students.count,
        totalTeachers: teachers.count,
        totalClasses: classes.count,
        totalSubjects: subjects.count,
        pendingApplications: pendingApplications.count,
        schoolsThisMonth: currentMonthSchoolCount,
        studentsThisMonth: currentMonthStudents.count,
        teachersThisMonth: currentMonthTeachers.count,
        monthlyGrowth: calculateSuperAdminMonthlyGrowth(currentMonthSchoolCount, previousMonthSchoolCount),
      },
    };
  }

  const { data: schoolsData, error: schoolsError } = await apiClient
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false });

  if (schoolsError) throw schoolsError;

  const schools = schoolsData || [];
  const totalSchools = schools.length;
  const activeSchools = schools.filter((school) => school.is_active).length;
  const schoolTypeStats = summarizeSchoolTypes(schools);

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [
    studentsResponse,
    teachersResponse,
    classesResponse,
    subjectsResponse,
    pendingApplicationsResponse,
    schoolAdminsResponse,
    currentMonthSchoolsResponse,
    currentMonthStudentsResponse,
    currentMonthTeachersResponse,
    previousMonthSchoolsResponse,
    auditResponse,
  ] = await Promise.all([
    apiClient.from('students').select('*', { count: 'exact', head: true }),
    apiClient.from('teachers').select('*', { count: 'exact', head: true }),
    apiClient.from('classes').select('*', { count: 'exact', head: true }),
    apiClient.from('subjects').select('*', { count: 'exact', head: true }),
    apiClient.from('teacher_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    apiClient.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'school_admin'),
    apiClient.from('schools').select('*', { count: 'exact', head: true }).gte('created_at', currentMonthStart),
    apiClient.from('students').select('*', { count: 'exact', head: true }).gte('created_at', currentMonthStart),
    apiClient.from('teachers').select('*', { count: 'exact', head: true }).gte('created_at', currentMonthStart),
    apiClient
      .from('schools')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousMonthStart)
      .lt('created_at', currentMonthStart),
    apiClient
      .from('audit_logs')
      .select('id, action, entity_type, timestamp, success, user_id')
      .order('timestamp', { ascending: false })
      .limit(8),
  ]);

  if (auditResponse.error) throw auditResponse.error;

  const currentMonthSchools = readCount(currentMonthSchoolsResponse);
  const previousMonthSchools = readCount(previousMonthSchoolsResponse);

  return {
    schools,
    schoolTypeStats,
    recentActivity: (auditResponse.data || []) as SuperAdminRecentAuditLog[],
    stats: {
      totalSchools,
      activeSchools,
      totalSchoolAdmins: readCount(schoolAdminsResponse),
      totalStudents: readCount(studentsResponse),
      totalTeachers: readCount(teachersResponse),
      totalClasses: readCount(classesResponse),
      totalSubjects: readCount(subjectsResponse),
      pendingApplications: readCount(pendingApplicationsResponse),
      schoolsThisMonth: currentMonthSchools,
      studentsThisMonth: readCount(currentMonthStudentsResponse),
      teachersThisMonth: readCount(currentMonthTeachersResponse),
      monthlyGrowth: calculateSuperAdminMonthlyGrowth(currentMonthSchools, previousMonthSchools),
    },
  };
}

export function useSuperAdminDashboardData() {
  const query = useCachedQuery(
    'realtime',
    [...queryKeys.analytics('super-admin-dashboard', {})],
    fetchSuperAdminDashboardData,
    {
      retry: 2,
      refetchInterval: dashboardRefreshIntervals.superAdmin,
      refetchIntervalInBackground: false,
    }
  );

  const data = query.data || defaultSuperAdminDashboardData;

  return {
    ...data,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    lastUpdatedAt: query.dataUpdatedAt,
  };
}
