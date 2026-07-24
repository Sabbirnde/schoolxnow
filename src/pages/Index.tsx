import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/components/Dashboard";
import { AccessDeniedFallback, ModuleLoadingSkeleton } from "@/components/AccessDeniedFallback";
import { StudentManagement } from "@/components/StudentManagement";
import { ClassManagement } from "@/components/ClassManagement";
import { SubjectManagement } from "@/components/SubjectManagement";
import { AttendanceManagement } from "@/components/AttendanceManagement";
import { ExamManagement } from "@/components/ExamManagement";
import { TimetableManagement } from "@/components/TimetableManagement";
import UserManagement from "@/components/UserManagement";
import SchoolAdminManagement from "@/components/SchoolAdminManagement";
import TeacherManagement from "@/components/TeacherManagement";
import SchoolManagement from "@/components/SchoolManagement";
import Settings from "@/components/Settings";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";
import SchoolAdminDashboard from "@/components/SchoolAdminDashboard";
import TeacherDashboard from "@/components/TeacherDashboard";
import { ExamMarksEntry } from "@/components/ExamMarksEntry";
import { ReportsAnalytics } from "@/components/ReportsAnalytics";
import SchoolAdminReportsDashboard from "@/components/SchoolAdminReportsDashboard";
import AcademicReports from "@/components/AcademicReports";
import TeacherPerformanceReports from "@/components/TeacherPerformanceReports";
import { ClassAssignment } from "@/components/ClassAssignment";
import { AcademicOperations } from "@/components/AcademicOperations";
import { BillingManagement } from "@/components/BillingManagement";

const Index = () => {
  const { user, profile, loading, profileState } = useAuth();
  const { canAccessModule } = useModuleAccess();
  const [activeModule, setActiveModule] = useState('dashboard');
  const [accessDenied, setAccessDenied] = useState(false);
  const [deniedModule, setDeniedModule] = useState<string | null>(null);

  // Handle module access validation
  const handleSetActiveModule = useCallback(
    (moduleId: string) => {
      const accessCheck = canAccessModule(moduleId);

      if (!accessCheck.canAccess) {
        console.warn(
          `[Module Access] Denied for module '${moduleId}':`,
          accessCheck.reason
        );
        setAccessDenied(true);
        setDeniedModule(moduleId);
        return;
      }

      // Access granted, clear any previous denied state
      setAccessDenied(false);
      setDeniedModule(null);
      setActiveModule(moduleId);
    },
    [canAccessModule]
  );

  // Redirect to landing page if not logged in
  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  // Show loading spinner while checking auth
  if (loading) {
    return <ModuleLoadingSkeleton />;
  }

  // Keep route in loading state only while profile resolution is in progress.
  if (user && (profileState?.status === 'idle' || profileState?.status === 'loading')) {
    return <ModuleLoadingSkeleton />;
  }

  // Show access denied screen if denied and not already on dashboard
  if (accessDenied && deniedModule) {
    return (
      <AccessDeniedFallback
        moduleId={deniedModule}
        onBackToDashboard={() => {
          setAccessDenied(false);
          setDeniedModule(null);
          setActiveModule('dashboard');
        }}
      />
    );
  }

  const renderContent = () => {
    // Role-based dashboard rendering
    if (profile?.role === 'super_admin') {
      switch (activeModule) {
        case 'students': return <StudentManagement />;
        case 'schools': return <SchoolManagement />;
        case 'users': return <SchoolAdminManagement />; // Super admin manages school admins
        case 'reports': return <SchoolAdminReportsDashboard />;
        case 'settings': return <Settings />;
        case 'dashboard':
        default: return <SuperAdminDashboard />;
      }
    }
    
    if (profile?.role === 'school_admin') {
      switch (activeModule) {
        case 'students': return <StudentManagement />;
        case 'classes': return <ClassManagement />;
        case 'subjects': return <SubjectManagement />;
        case 'attendance': return <AttendanceManagement />;
        case 'exams': return <ExamManagement />;
        case 'timetable': return <TimetableManagement />;
        case 'users': return <TeacherManagement />; // School admin manages teachers
        case 'reports': return <SchoolAdminReportsDashboard />;
        case 'teacher-reports': return <TeacherPerformanceReports />;
        case 'class-assignment': return <ClassAssignment />;
        case 'academic-operations': return <AcademicOperations />;
        case 'billing': return <BillingManagement />;
        case 'settings': return <Settings />;
        case 'dashboard':
        default: return <SchoolAdminDashboard setActiveModule={handleSetActiveModule} />;
      }
    }
    
    if (profile?.role === 'teacher') {
      switch (activeModule) {
        case 'students': return <StudentManagement />;
        case 'subjects': return <SubjectManagement />;
        case 'attendance': return <AttendanceManagement />;
        case 'exam-marks': return (
          <div className="container mx-auto p-4 md:p-6 space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Enter Exam Marks</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Enter and manage student exam marks
              </p>
            </div>
            <ExamMarksEntry />
          </div>
        );
        case 'exams': return <ExamManagement />;
        case 'timetable': return <TimetableManagement />;
        case 'classes': return <ClassManagement />;
        case 'dashboard':
        default: return <TeacherDashboard setActiveModule={setActiveModule} />;
      }
    }

    // Fallback to module-based rendering for backward compatibility
    switch (activeModule) {
      case 'students': return <StudentManagement />;
      case 'classes': return <ClassManagement />;
      case 'subjects': return <SubjectManagement />;
      case 'dashboard':
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeModule={activeModule} setActiveModule={handleSetActiveModule}>
      {renderContent()}
    </Layout>
  );
};

export default Index;
