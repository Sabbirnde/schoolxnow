import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

type MockAuthState = {
  user: { id: string; email: string } | null;
  profile: {
    user_id: string;
    full_name: string;
    role: string;
    school_id: string | null;
    approval_status: string;
  } | null;
  profileState: {
    status: string;
    userId: string | null;
    error: string | null;
    updatedAt: string;
  };
  loading: boolean;
};

let mockAuthState: MockAuthState;

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/hooks/useModuleAccess', () => ({
  useModuleAccess: () => ({
    canAccessModule: vi.fn(() => ({
      canAccess: true,
      feature: 'dashboard',
      requiredLevel: 'read-only',
    })),
  }),
}));

vi.mock('@/components/Layout', () => ({
  Layout: ({
    children,
    setActiveModule,
  }: {
    children: React.ReactNode;
    setActiveModule: (moduleId: string) => void;
  }) => (
    <div data-testid="layout">
      <button onClick={() => setActiveModule('reports')}>Open reports</button>
      {children}
    </div>
  ),
}));

vi.mock('@/components/AccessDeniedFallback', () => ({
  AccessDeniedFallback: () => <div data-testid="access-denied">Access Denied</div>,
  ModuleLoadingSkeleton: () => <div data-testid="module-loading">Loading</div>,
}));

vi.mock('@/components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard">Dashboard</div>,
}));

vi.mock('@/components/StudentManagement', () => ({
  StudentManagement: () => <div data-testid="students">Students</div>,
}));

vi.mock('@/components/ClassManagement', () => ({
  ClassManagement: () => <div data-testid="classes">Classes</div>,
}));

vi.mock('@/components/SubjectManagement', () => ({
  SubjectManagement: () => <div data-testid="subjects">Subjects</div>,
}));

vi.mock('@/components/AttendanceManagement', () => ({
  AttendanceManagement: () => <div data-testid="attendance">Attendance</div>,
}));

vi.mock('@/components/ExamManagement', () => ({
  ExamManagement: () => <div data-testid="exams">Exams</div>,
}));

vi.mock('@/components/TimetableManagement', () => ({
  TimetableManagement: () => <div data-testid="timetable">Timetable</div>,
}));

vi.mock('@/components/UserManagement', () => ({
  default: () => <div data-testid="user-management">User Management</div>,
}));

vi.mock('@/components/SchoolAdminManagement', () => ({
  default: () => <div data-testid="school-admin-management">School Admin Management</div>,
}));

vi.mock('@/components/TeacherManagement', () => ({
  default: () => <div data-testid="teacher-management">Teacher Management</div>,
}));

vi.mock('@/components/SchoolManagement', () => ({
  default: () => <div data-testid="school-management">School Management</div>,
}));

vi.mock('@/components/Settings', () => ({
  default: () => <div data-testid="settings">Settings</div>,
}));

vi.mock('@/components/SuperAdminDashboard', () => ({
  default: () => <div data-testid="super-admin-dashboard">Super Admin Dashboard</div>,
}));

vi.mock('@/components/SchoolAdminDashboard', () => ({
  default: () => <div data-testid="school-admin-dashboard">School Admin Dashboard</div>,
}));

vi.mock('@/components/SuperAdminReportsDashboard', () => ({
  default: () => <div data-testid="super-admin-reports">Super Admin Reports</div>,
}));

vi.mock('@/components/TeacherDashboard', () => ({
  default: () => <div data-testid="teacher-dashboard">Teacher Dashboard</div>,
}));

vi.mock('@/components/ExamMarksEntry', () => ({
  ExamMarksEntry: () => <div data-testid="exam-marks">Exam Marks</div>,
}));

vi.mock('@/components/ReportsAnalytics', () => ({
  ReportsAnalytics: () => <div data-testid="reports">Reports</div>,
}));

vi.mock('@/components/ClassAssignment', () => ({
  ClassAssignment: () => <div data-testid="class-assignment">Class Assignment</div>,
}));

vi.mock('@/components/AcademicOperations', () => ({
  AcademicOperations: () => <div data-testid="academic-operations">Academic Operations</div>,
}));

import Index from './Index';

const renderIndex = () => {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/" element={<div data-testid="home-page">Home</div>} />
        <Route path="/dashboard" element={<Index />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Index routing regression', () => {
  beforeEach(() => {
    mockAuthState = {
      user: { id: 'u1', email: 'schooladmin@test.com' },
      profile: {
        user_id: 'u1',
        full_name: 'School Admin',
        role: 'school_admin',
        school_id: 's1',
        approval_status: 'approved',
      },
      profileState: {
        status: 'ready',
        userId: 'u1',
        error: null,
        updatedAt: new Date().toISOString(),
      },
      loading: false,
    };
  });

  it('renders School Admin dashboard for school_admin role', () => {
    renderIndex();

    expect(screen.getByTestId('school-admin-dashboard')).toBeInTheDocument();
  });

  it('routes super admins to platform reports instead of school-scoped reports', () => {
    mockAuthState = {
      ...mockAuthState,
      profile: {
        ...mockAuthState.profile!,
        role: 'super_admin',
        school_id: null,
      },
    };
    renderIndex();

    fireEvent.click(screen.getByRole('button', { name: 'Open reports' }));

    expect(screen.getByTestId('super-admin-reports')).toBeInTheDocument();
  });

  it('shows loading skeleton while profile is still resolving for authenticated user', () => {
    mockAuthState = {
      user: { id: 'u1', email: 'schooladmin@test.com' },
      profile: null,
      profileState: {
        status: 'loading',
        userId: 'u1',
        error: null,
        updatedAt: new Date().toISOString(),
      },
      loading: false,
    };

    renderIndex();

    expect(screen.getByTestId('module-loading')).toBeInTheDocument();
  });

  it('redirects to home when logged out', () => {
    mockAuthState = {
      user: null,
      profile: null,
      profileState: {
        status: 'idle',
        userId: null,
        error: null,
        updatedAt: new Date().toISOString(),
      },
      loading: false,
    };

    renderIndex();

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
  });

  it('handles logout transition without rendering fallback dashboard', () => {
    const result = renderIndex();

    expect(screen.getByTestId('school-admin-dashboard')).toBeInTheDocument();

    mockAuthState = {
      user: null,
      profile: null,
      profileState: {
        status: 'idle',
        userId: null,
        error: null,
        updatedAt: new Date().toISOString(),
      },
      loading: false,
    };

    result.rerender(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
          <Route path="/dashboard" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});
