import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockAuditLogs, mockSchools } from '@/test/mockData';
import {
  calculateSuperAdminMonthlyGrowth,
  fetchSuperAdminDashboardData,
  summarizeSchoolTypes,
} from './useSuperAdminDashboardData';

type QueryResult = {
  data: unknown;
  count?: number | null;
  error: unknown;
};

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: Promise<QueryResult>['then'];
};

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/integrations/php-api/compat-client', () => ({
  supabase: {
    from: fromMock,
  },
}));

const countByTable: Record<string, number> = {
  students: 1545,
  teachers: 89,
  classes: 45,
  subjects: 120,
  teacher_applications: 5,
  user_roles: 12,
};

const createQueryMock = (table: string): QueryMock => {
  let isCountQuery = false;
  let isPreviousMonthSchoolsQuery = false;

  const resolveQuery = (): Promise<QueryResult> => {
    if (table === 'schools' && !isCountQuery) {
      return Promise.resolve({ data: mockSchools, error: null });
    }

    if (table === 'schools' && isPreviousMonthSchoolsQuery) {
      return Promise.resolve({ data: null, count: 2, error: null });
    }

    if (table === 'schools' && isCountQuery) {
      return Promise.resolve({ data: null, count: 1, error: null });
    }

    return Promise.resolve({
      data: null,
      count: countByTable[table] ?? 0,
      error: null,
    });
  };

  const query: QueryMock = {
    select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
      isCountQuery = Boolean(options?.count);
      return query;
    }),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lt: vi.fn(() => {
      isPreviousMonthSchoolsQuery = true;
      return query;
    }),
    limit: vi.fn(() => Promise.resolve({ data: table === 'audit_logs' ? mockAuditLogs : [], error: null })),
    then: (resolve, reject) => resolveQuery().then(resolve, reject),
  };

  return query;
};

describe('useSuperAdminDashboardData fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation((table: string) => createQueryMock(table));
  });

  it('summarizes school type counts', () => {
    expect(summarizeSchoolTypes(mockSchools)).toEqual({
      bangla_medium: 1,
      english_medium: 1,
      madrasha: 1,
    });
  });

  it('calculates monthly growth with zero previous month fallback', () => {
    expect(calculateSuperAdminMonthlyGrowth(3, 0)).toBe(100);
    expect(calculateSuperAdminMonthlyGrowth(0, 0)).toBe(0);
  });

  it('fetches schools, platform counts, growth, and recent activity', async () => {
    const data = await fetchSuperAdminDashboardData();

    expect(fromMock).toHaveBeenCalledWith('schools');
    expect(fromMock).toHaveBeenCalledWith('students');
    expect(fromMock).toHaveBeenCalledWith('teachers');
    expect(fromMock).toHaveBeenCalledWith('audit_logs');
    expect(data.schools).toHaveLength(mockSchools.length);
    expect(data.schoolTypeStats).toEqual({
      bangla_medium: 1,
      english_medium: 1,
      madrasha: 1,
    });
    expect(data.stats).toMatchObject({
      totalSchools: mockSchools.length,
      activeSchools: mockSchools.filter((school) => school.is_active).length,
      totalStudents: 1545,
      totalTeachers: 89,
      totalSchoolAdmins: 12,
      pendingApplications: 5,
      schoolsThisMonth: 1,
      monthlyGrowth: -50,
    });
    expect(data.recentActivity).toEqual(mockAuditLogs);
  });
});
