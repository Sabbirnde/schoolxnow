import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSchoolAdminDashboardData,
  type SchoolAdminDashboardData,
} from './useSchoolAdminDashboardData';
import type { SchoolStats } from './useSchoolStats';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/backend/provider', () => ({
  isPhpBackend: false,
}));

vi.mock('@/integrations/php-api/api-client', () => ({
  apiClient: {
    from: fromMock,
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('fetchSchoolAdminDashboardData optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts school, statistics, and recent-student requests concurrently', async () => {
    const schoolRequest = deferred<{
      data: SchoolAdminDashboardData['schoolInfo'];
      error: null;
    }>();
    const studentsRequest = deferred<{
      data: SchoolAdminDashboardData['recentActivities'];
      error: null;
    }>();
    const statsRequest = deferred<SchoolStats>();
    const fetchSchoolStats = vi.fn(() => statsRequest.promise);

    fromMock.mockImplementation((table: string) => {
      if (table === 'schools') {
        return {
          select: () => ({
            eq: () => ({
              single: () => schoolRequest.promise,
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => studentsRequest.promise,
            }),
          }),
        }),
      };
    });

    const resultPromise = fetchSchoolAdminDashboardData('school-1', fetchSchoolStats);

    expect(fromMock).toHaveBeenCalledWith('schools');
    expect(fromMock).toHaveBeenCalledWith('students');
    expect(fetchSchoolStats).toHaveBeenCalledWith('school-1');

    schoolRequest.resolve({
      data: {
        name: 'Test School',
        name_bangla: null,
        school_type: 'english_medium',
      },
      error: null,
    });
    studentsRequest.resolve({ data: [], error: null });
    statsRequest.resolve({
      totalStudents: 100,
      activeStudents: 95,
      totalTeachers: 10,
      totalClasses: 5,
      totalSubjects: 8,
      recentAdmissions: 4,
    });

    await expect(resultPromise).resolves.toMatchObject({
      schoolInfo: { name: 'Test School' },
      stats: { totalStudents: 100 },
      recentActivities: [],
    });
  });
});
