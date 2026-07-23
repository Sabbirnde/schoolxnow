import { useCallback } from 'react';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';

export interface SchoolStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  recentAdmissions: number;
}

interface RpcResponse<T> {
  data: T | null;
  error: unknown;
}

/**
 * Hook to fetch consolidated school statistics from backend RPC function.
 * Uses single get_school_stats RPC call instead of 6 separate count queries.
 * 
 * Benefits:
 * - Reduces network requests from 6 to 1
 * - Single backend query is more efficient
 * - Centralized stats calculation in database
 * - Easier to maintain and modify stats logic
 * 
 * @returns Async function to fetch stats for a given school_id
 */
export function useSchoolStats() {
  const fetchSchoolStats = useCallback(
    async (schoolId: string | null): Promise<SchoolStats> => {
      if (!schoolId) {
        return {
          totalStudents: 0,
          activeStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSubjects: 0,
          recentAdmissions: 0,
        };
      }

      try {
        if (isPhpBackend) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const [
            totalStudents,
            activeStudents,
            totalTeachers,
            totalClasses,
            totalSubjects,
            recentAdmissions,
          ] = await Promise.all([
            phpApi.table('students').count({ school_id: schoolId }),
            phpApi.table('students').count({ school_id: schoolId, status: 'active' }),
            phpApi.table('teachers').count({ school_id: schoolId }),
            phpApi.table('classes').count({ school_id: schoolId }),
            phpApi.table('subjects').count({ school_id: schoolId }),
            phpApi.table('students').count({
              school_id: schoolId,
              admission_date__gte: thirtyDaysAgo.toISOString().split('T')[0],
            }),
          ]);

          return {
            totalStudents: totalStudents.count,
            activeStudents: activeStudents.count,
            totalTeachers: totalTeachers.count,
            totalClasses: totalClasses.count,
            totalSubjects: totalSubjects.count,
            recentAdmissions: recentAdmissions.count,
          };
        }

        // Call RPC function and cast response to SchoolStats
        const rpc = apiClient.rpc as unknown as (
          fn: 'get_school_stats',
          args: { p_school_id: string }
        ) => Promise<RpcResponse<SchoolStats>>;
        const { data, error } = await rpc(
          'get_school_stats',
          { p_school_id: schoolId }
        );

        if (error) {
          console.error('[useSchoolStats] RPC error:', error);
          throw error;
        }

        // Type the response data properly
        const stats = data as SchoolStats;
        
        return {
          totalStudents: stats?.totalStudents || 0,
          activeStudents: stats?.activeStudents || 0,
          totalTeachers: stats?.totalTeachers || 0,
          totalClasses: stats?.totalClasses || 0,
          totalSubjects: stats?.totalSubjects || 0,
          recentAdmissions: stats?.recentAdmissions || 0,
        };
      } catch (error) {
        console.error('[useSchoolStats] Error fetching school stats:', error);
        // Return safe defaults on error
        return {
          totalStudents: 0,
          activeStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSubjects: 0,
          recentAdmissions: 0,
        };
      }
    },
    []
  );

  return fetchSchoolStats;
}
