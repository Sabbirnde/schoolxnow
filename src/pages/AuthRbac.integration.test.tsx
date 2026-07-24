import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AccessLevel, UserRole } from '@/lib/access-control';

type MockAuthState = {
  user: { id: string; email: string } | null;
  profile: {
    user_id: string;
    full_name: string;
    role: UserRole;
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
const mockCan = vi.fn((_feature: string, _requiredLevel?: AccessLevel) => true);
const mockCanAccessModule = vi.fn((moduleId: string) => ({
  canAccess: true,
  feature: moduleId,
  requiredLevel: 'read-only',
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    can: mockCan,
    canFull: vi.fn(() => true),
    canView: vi.fn(() => true),
    level: vi.fn(() => 'full'),
    role: mockAuthState.profile?.role ?? 'student',
    is: vi.fn((role: UserRole | UserRole[]) => {
      const roles = Array.isArray(role) ? role : [role];
      return mockAuthState.profile ? roles.includes(mockAuthState.profile.role) : false;
    }),
  }),
}));

vi.mock('@/hooks/useModuleAccess', () => ({
  useModuleAccess: () => ({
    canAccessModule: mockCanAccessModule,
  }),
}));

vi.mock('@/components/Layout', () => ({
  Layout: ({
    children,
    activeModule,
    setActiveModule,
  }: {
    children: React.ReactNode;
    activeModule: string;
    setActiveModule: (moduleId: string) => void;
  }) => (
    <div data-testid="layout" data-active-module={activeModule}>
      <button type="button" onClick={() => setActiveModule('users')}>
        Users
      </button>
      <button type="button" onClick={() => setActiveModule('exam-marks')}>
        Exam Marks
      </button>
      <button type="button" onClick={() => setActiveModule('academic-operations')}>
        Academic Operations
      </button>
      {children}
    </div>
  ),
}));

vi.mock('@/components/AccessDeniedFallback', () => ({
  AccessDeniedFallback: ({ moduleId }: { moduleId: string }) => (
    <div data-testid="access-denied">Denied {moduleId}</div>
  ),
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

vi.mock('@/components/TeacherDashboard', () => ({
  default: () => <div data-testid="teacher-dashboard">Teacher Dashboard</div>,
}));

vi.mock('@/components/ExamMarksEntry', () => ({
  ExamMarksEntry: () => <div data-testid="exam-marks-entry">Exam Marks Entry</div>,
}));

vi.mock('@/components/ReportsAnalytics', () => ({
  ReportsAnalytics: () => <div data-testid="reports">Reports</div>,
}));

vi.mock('@/components/SchoolAdminReportsDashboard', () => ({
  default: () => <div data-testid="school-admin-reports">School Admin Reports</div>,
}));

vi.mock('@/components/AcademicReports', () => ({
  default: () => <div data-testid="academic-reports">Academic Reports</div>,
}));

vi.mock('@/components/TeacherPerformanceReports', () => ({
  default: () => <div data-testid="teacher-performance-reports">Teacher Reports</div>,
}));

vi.mock('@/components/ClassAssignment', () => ({
  ClassAssignment: () => <div data-testid="class-assignment">Class Assignment</div>,
}));

vi.mock('@/components/AcademicOperations', () => ({
  AcademicOperations: () => <div data-testid="academic-operations">Academic Operations</div>,
}));

import { FeatureGuard, ProtectedRoute, RoleGuard } from '@/components/FeatureGuard';
import Index from './Index';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const authStateFor = (role: UserRole): MockAuthState => ({
  user: { id: `${role}-user`, email: `${role}@example.com` },
  profile: {
    user_id: `${role}-user`,
    full_name: role.replace('_', ' '),
    role,
    school_id: role === 'super_admin' ? null : 'school-1',
    approval_status: 'approved',
  },
  profileState: {
    status: 'ready',
    userId: `${role}-user`,
    error: null,
    updatedAt: new Date().toISOString(),
  },
  loading: false,
});

const unauthenticatedState = (): MockAuthState => ({
  user: null,
  profile: null,
  profileState: {
    status: 'idle',
    userId: null,
    error: null,
    updatedAt: new Date().toISOString(),
  },
  loading: false,
});

const authLoadingState = (): MockAuthState => ({
  user: null,
  profile: null,
  profileState: {
    status: 'idle',
    userId: null,
    error: null,
    updatedAt: new Date().toISOString(),
  },
  loading: true,
});

const profileLoadingState = (): MockAuthState => ({
  user: { id: 'school_admin-user', email: 'school_admin@example.com' },
  profile: null,
  profileState: {
    status: 'loading',
    userId: 'school_admin-user',
    error: null,
    updatedAt: new Date().toISOString(),
  },
  loading: false,
});

const renderDashboard = (initialPath = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div data-testid="landing-page">Landing</div>} />
        <Route path="/dashboard" element={<Index />} />
      </Routes>
    </MemoryRouter>
  );

const renderProtectedRoute = (
  initialPath: string,
  routeElement: React.ReactNode
) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
        <Route path={initialPath} element={routeElement} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );

describe('Auth/RBAC integration', () => {
  beforeEach(() => {
    mockAuthState = authStateFor('school_admin');
    mockCan.mockReturnValue(true);
    mockCanAccessModule.mockImplementation((moduleId: string) => ({
      canAccess: true,
      feature: moduleId,
      requiredLevel: 'read-only',
    }));
  });

  it('renders the super admin dashboard and routes users module to school admin management', async () => {
    mockAuthState = authStateFor('super_admin');

    renderDashboard();

    expect(screen.getByTestId('super-admin-dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Users' }));

    expect(await screen.findByTestId('school-admin-management')).toBeInTheDocument();
    expect(screen.queryByTestId('teacher-management')).not.toBeInTheDocument();
  });

  it('renders the school admin dashboard and routes users module to teacher management', async () => {
    mockAuthState = authStateFor('school_admin');

    renderDashboard();

    expect(screen.getByTestId('school-admin-dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Users' }));

    expect(await screen.findByTestId('teacher-management')).toBeInTheDocument();
    expect(screen.queryByTestId('school-admin-management')).not.toBeInTheDocument();
  });

  it('routes school administrators to the academic operations workspace', async () => {
    mockAuthState = authStateFor('school_admin');
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Academic Operations' }));

    expect(await screen.findByTestId('academic-operations')).toBeInTheDocument();
    expect(mockCanAccessModule).toHaveBeenCalledWith('academic-operations');
  });

  it('renders the teacher dashboard and routes exam marks to marks entry', async () => {
    mockAuthState = authStateFor('teacher');

    renderDashboard();

    expect(screen.getByTestId('teacher-dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Exam Marks' }));

    expect(await screen.findByTestId('exam-marks-entry')).toBeInTheDocument();
  });

  it('redirects unauthenticated dashboard users to the landing page', () => {
    mockAuthState = unauthenticatedState();

    renderDashboard();

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('keeps dashboard routes in loading state while auth is resolving', () => {
    mockAuthState = authLoadingState();

    renderDashboard();

    expect(screen.getByTestId('module-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  it('keeps authenticated users in loading state while profile is resolving', () => {
    mockAuthState = profileLoadingState();

    renderDashboard();

    expect(screen.getByTestId('module-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('shows access denied when a role cannot open a dashboard module', () => {
    mockAuthState = authStateFor('teacher');
    mockCanAccessModule.mockImplementation((moduleId: string) => ({
      canAccess: moduleId !== 'users',
      feature: moduleId,
      requiredLevel: 'read-only',
      reason: 'Teachers cannot manage users',
    }));

    renderDashboard();

    expect(screen.getByTestId('teacher-dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Users' }));

    expect(screen.getByTestId('access-denied')).toHaveTextContent('Denied users');
    expect(screen.queryByTestId('user-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('teacher-management')).not.toBeInTheDocument();
  });

  it('allows a teacher through teacher-only protected routes', () => {
    mockAuthState = authStateFor('teacher');

    renderProtectedRoute(
      '/teacher-portal',
      <ProtectedRoute roles="teacher" redirectTo="/dashboard">
        <div data-testid="teacher-portal">Teacher Portal</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('teacher-portal')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher-portal');
  });

  it('redirects the wrong authenticated role away from teacher-only routes', () => {
    mockAuthState = authStateFor('school_admin');

    renderProtectedRoute(
      '/teacher-portal',
      <ProtectedRoute roles="teacher" redirectTo="/dashboard">
        <div data-testid="teacher-portal">Teacher Portal</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('allows super admin through super-admin-only protected routes', () => {
    mockAuthState = authStateFor('super_admin');

    renderProtectedRoute(
      '/system-admin-access',
      <ProtectedRoute roles="super_admin" redirectTo="/dashboard">
        <div data-testid="system-admin-access">System Admin Access</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('system-admin-access')).toBeInTheDocument();
  });

  it('redirects unauthenticated protected-route users to auth', () => {
    mockAuthState = unauthenticatedState();

    renderProtectedRoute(
      '/system-admin-access',
      <ProtectedRoute roles="super_admin" redirectTo="/dashboard">
        <div data-testid="system-admin-access">System Admin Access</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/auth');
  });

  it('redirects authenticated users when a protected feature is denied', () => {
    mockAuthState = authStateFor('teacher');
    mockCan.mockReturnValue(false);

    renderProtectedRoute(
      '/restricted-feature',
      <ProtectedRoute feature="schools.create" requiredLevel="full" redirectTo="/dashboard">
        <div data-testid="restricted-feature">Restricted Feature</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    expect(mockCan).toHaveBeenCalledWith('schools.create', 'full');
  });

  it('shows protected route loading state while auth is resolving', () => {
    mockAuthState = authLoadingState();

    renderProtectedRoute(
      '/teacher-portal',
      <ProtectedRoute roles="teacher" redirectTo="/dashboard">
        <div data-testid="teacher-portal">Teacher Portal</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher-portal');
  });

  it('renders RoleGuard children for allowed roles and fallback for denied roles', () => {
    mockAuthState = authStateFor('school_admin');

    const { rerender } = render(
      <RoleGuard roles={['super_admin', 'school_admin']} fallback={<div data-testid="role-denied">Denied</div>}>
        <div data-testid="role-allowed">Allowed</div>
      </RoleGuard>
    );

    expect(screen.getByTestId('role-allowed')).toBeInTheDocument();

    mockAuthState = authStateFor('teacher');

    rerender(
      <RoleGuard roles={['super_admin', 'school_admin']} fallback={<div data-testid="role-denied">Denied</div>}>
        <div data-testid="role-allowed">Allowed</div>
      </RoleGuard>
    );

    expect(screen.getByTestId('role-denied')).toBeInTheDocument();
  });

  it('renders FeatureGuard children only when required feature access is granted', () => {
    mockAuthState = authStateFor('school_admin');
    mockCan.mockReturnValue(true);

    const { rerender } = render(
      <FeatureGuard feature="schools.edit" requiredLevel="full" fallback={<div data-testid="feature-denied">Denied</div>}>
        <div data-testid="feature-allowed">Allowed</div>
      </FeatureGuard>
    );

    expect(screen.getByTestId('feature-allowed')).toBeInTheDocument();
    expect(mockCan).toHaveBeenCalledWith('schools.edit', 'full');

    mockCan.mockReturnValue(false);

    rerender(
      <FeatureGuard feature="schools.edit" requiredLevel="full" fallback={<div data-testid="feature-denied">Denied</div>}>
        <div data-testid="feature-allowed">Allowed</div>
      </FeatureGuard>
    );

    expect(screen.getByTestId('feature-denied')).toBeInTheDocument();
  });
});
