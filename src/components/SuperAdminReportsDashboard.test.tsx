import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  buildPlatformReportMetrics,
  SuperAdminReportsDashboard,
} from './SuperAdminReportsDashboard';
import { defaultSuperAdminDashboardStats } from '@/hooks/useSuperAdminDashboardData';

const dashboardState = vi.hoisted(() => ({
  stats: {
    totalSchools: 10,
    activeSchools: 8,
    totalSchoolAdmins: 7,
    totalStudents: 1200,
    totalTeachers: 80,
    totalClasses: 48,
    totalSubjects: 16,
    pendingApplications: 4,
    schoolsThisMonth: 2,
    studentsThisMonth: 100,
    teachersThisMonth: 8,
    monthlyGrowth: 25,
  },
  schoolTypeStats: {
    bangla_medium: 5,
    english_medium: 3,
    madrasha: 2,
  },
  schools: [],
  recentActivity: [],
  loading: false,
  fetching: false,
  error: null,
  refetch: vi.fn(),
  lastUpdatedAt: Date.now(),
}));

vi.mock('@/hooks/useSuperAdminDashboardData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useSuperAdminDashboardData')>();
  return {
    ...actual,
    useSuperAdminDashboardData: () => dashboardState,
  };
});

describe('SuperAdminReportsDashboard', () => {
  it('calculates safe platform ratios when the network is empty', () => {
    expect(buildPlatformReportMetrics(defaultSuperAdminDashboardStats)).toEqual({
      activationRate: 0,
      studentsPerSchool: 0,
      teachersPerSchool: 0,
      studentTeacherRatio: 0,
      adminCoverage: 0,
      inactiveSchools: 0,
      schoolsWithoutAdmin: 0,
    });
  });

  it('renders network-level metrics without requiring a school id', () => {
    render(<SuperAdminReportsDashboard />);

    expect(screen.getByText('Platform scope')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('80% activation')).toBeInTheDocument();
    expect(screen.getByText('15:1 student–teacher ratio')).toBeInTheDocument();
    expect(screen.getByText('Schools without admin coverage')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('keeps the report visible during a background refresh', () => {
    dashboardState.fetching = true;
    const { rerender } = render(<SuperAdminReportsDashboard />);

    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh dashboard data' })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    dashboardState.fetching = false;
    rerender(<SuperAdminReportsDashboard />);
  });
});
