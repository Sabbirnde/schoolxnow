import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolAdminDashboardData } from "@/hooks/useSchoolAdminDashboardData";
import { useToast } from "@/hooks/use-toast";
import { PendingAssignmentCard } from "@/components/PendingAssignmentCard";
import { DashboardSkeleton } from "@/components/ui/skeleton-loader";
import { TeacherApplicationsManager } from "@/components/TeacherApplicationsManager";
import { AttendanceManagement } from "@/components/AttendanceManagement";
import { ExamManagement } from "@/components/ExamManagement";
import { EnhancedActivityFeed } from "@/components/SchoolAdmin/EnhancedActivityFeed";
import { TodaysTasksOverview } from "@/components/SchoolAdmin/TodaysTasksOverview";
import { StatsCardWithTrends } from "@/components/SchoolAdmin/StatsCardWithTrends";
import { StatsDetailModal } from "@/components/SchoolAdmin/StatsDetailModal";
import { handleApiError } from "@/lib/api-error-handler";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  School, 
  UserPlus, 
  Settings,
  Calendar,
  BarChart3,
  FileText,
  TrendingUp,
  ClipboardList,
  Award,
  Clock,
  Activity
} from "lucide-react";

interface SchoolAdminDashboardProps {
  setActiveModule?: (moduleId: string) => void;
}

const SchoolAdminDashboard = ({ setActiveModule }: SchoolAdminDashboardProps) => {
  const { profile } = useAuth();
  const {
    stats,
    schoolInfo,
    loading,
    error: dashboardError,
  } = useSchoolAdminDashboardData(profile?.school_id);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  
  // Modal state for stats drill-down
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedStatType, setSelectedStatType] = useState<string | null>(null);
  const [statsModalData, setStatsModalData] = useState<Record<string, unknown>[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (!dashboardError) return;

    const notice = handleApiError('Load school admin dashboard', dashboardError, {
      context: { schoolId: profile?.school_id },
      log: false,
    });
    toast({
      title: notice.title,
      description: notice.description,
      variant: "destructive",
    });
  }, [dashboardError, profile?.school_id, toast]);

  const getSchoolTypeLabel = (type: string) => {
    switch (type) {
      case 'bangla_medium':
        return 'Bangla Medium';
      case 'english_medium':
        return 'English Medium';
      case 'madrasha':
        return 'Madrasha';
      default:
        return type;
    }
  };

  // Handle stat card click to open drill-down modal
  const handleStatClick = async (statType: string) => {
    setSelectedStatType(statType);
    setStatsLoading(true);
    
    try {
      if (!profile?.school_id) throw new Error('School ID not found');

      let data: Record<string, unknown>[] = [];

      if (isPhpBackend) {
        switch (statType) {
          case 'totalStudents':
          case 'activeStudents':
          case 'recentAdmissions': {
            const filters: Record<string, string | number | boolean> = {
              school_id: profile.school_id,
              sort: 'admission_date',
              order: 'desc',
              limit: 200,
            };

            if (statType !== 'totalStudents') {
              filters.status = 'active';
            }

            if (statType === 'recentAdmissions') {
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              filters.admission_date__gte = thirtyDaysAgo.toISOString();
            }

            const [students, classes] = await Promise.all([
              phpApi.table<Record<string, unknown>>('students').list(filters),
              phpApi.table<{ id: string; name: string }>('classes').list({
                school_id: profile.school_id,
                limit: 200,
              }),
            ]);
            const classesById = new Map(classes.map((classItem) => [classItem.id, classItem]));
            data = students.map((student) => ({
              ...student,
              classes: classesById.get(String(student.class_id || '')) || null,
            }));
            break;
          }

          case 'totalTeachers':
            data = await phpApi.table<Record<string, unknown>>('teachers').list({
              school_id: profile.school_id,
              sort: 'created_at',
              order: 'desc',
              limit: 200,
            });
            break;

          case 'totalClasses':
            data = await phpApi.table<Record<string, unknown>>('classes').list({
              school_id: profile.school_id,
              sort: 'name',
              order: 'asc',
              limit: 200,
            });
            break;

          case 'totalSubjects':
            data = await phpApi.table<Record<string, unknown>>('subjects').list({
              school_id: profile.school_id,
              sort: 'name',
              order: 'asc',
              limit: 200,
            });
            break;
        }

        setStatsModalData(data);
        setStatsModalOpen(true);
        return;
      }

      switch (statType) {
        case 'totalStudents': {
          const { data: allStudents, error } = await apiClient
            .from('students')
            .select('id, full_name, student_id, class_id, status, admission_date, classes(name)')
            .eq('school_id', profile.school_id)
            .order('admission_date', { ascending: false });
          if (error) throw error;
          data = (allStudents || []) as unknown as Record<string, unknown>[];
          break;
        }

        case 'activeStudents': {
          const { data: active, error } = await apiClient
            .from('students')
            .select('id, full_name, student_id, class_id, status, admission_date, classes(name)')
            .eq('school_id', profile.school_id)
            .eq('status', 'active')
            .order('admission_date', { ascending: false });
          if (error) throw error;
          data = (active || []) as unknown as Record<string, unknown>[];
          break;
        }

        case 'totalTeachers': {
          const { data: teachers, error } = await apiClient
            .from('teachers')
            .select('id, full_name, email, phone, is_active, created_at')
            .eq('school_id', profile.school_id)
            .order('created_at', { ascending: false });
          if (error) throw error;
          data = (teachers || []) as Record<string, unknown>[];
          break;
        }

        case 'totalClasses': {
          const { data: classes, error } = await apiClient
            .from('classes')
            .select('id, name, section, is_active, created_at')
            .eq('school_id', profile.school_id)
            .order('name', { ascending: true });
          if (error) throw error;
          data = (classes || []) as Record<string, unknown>[];
          break;
        }

        case 'totalSubjects': {
          const { data: subjects, error } = await apiClient
            .from('subjects')
            .select('id, name, is_active, created_at')
            .eq('school_id', profile.school_id)
            .order('name', { ascending: true });
          if (error) throw error;
          data = (subjects || []) as Record<string, unknown>[];
          break;
        }

        case 'recentAdmissions': {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const { data: recent, error } = await apiClient
            .from('students')
            .select('id, full_name, student_id, class_id, status, admission_date, classes(name)')
            .eq('school_id', profile.school_id)
            .eq('status', 'active')
            .gte('admission_date', thirtyDaysAgo.toISOString())
            .order('admission_date', { ascending: false });
          if (error) throw error;
          data = (recent || []) as unknown as Record<string, unknown>[];
          break;
        }
      }

      setStatsModalData(data);
      setStatsModalOpen(true);
    } catch (error: unknown) {
      const notice = handleApiError('Load dashboard detail data', error, {
        context: { schoolId: profile?.school_id, statType },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: 'destructive',
      });
    } finally {
      setStatsLoading(false);
    }
  };

  if (!profile) {
    return <DashboardSkeleton />;
  }

  // Show pending assignment screen if school admin is not assigned to a school yet
  if (profile.approval_status === 'pending' || !profile.school_id) {
    const handleRefreshStatus = async () => {
      setIsRefreshing(true);
      try {
        if (isPhpBackend) {
          await phpApi.me();
          window.location.reload();
          return;
        }

        const { data: { user } } = await apiClient.auth.getUser();
        if (user) {
          const { data } = await apiClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (data) {
            // Re-fetch profile which triggers re-render if status changed
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('Error checking status:', error);
        toast({
          title: 'Error',
          description: 'Could not check status. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsRefreshing(false);
      }
    };

    return (
      <PendingAssignmentCard
        type="school_admin"
        fullName={profile?.full_name || 'User'}
        applicationDate={profile?.created_at || new Date().toISOString()}
        approvalStatus={profile?.approval_status || 'pending'}
        applicationId={profile?.user_id}
        onRefresh={handleRefreshStatus}
        isRefreshing={isRefreshing}
      />
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header with gradient background */}
      <div className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-8 border border-primary/10 shadow-elegant overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <School className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                {schoolInfo?.name || 'School Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {schoolInfo?.name_bangla && (
                <>
                  <span className="text-sm">{schoolInfo.name_bangla}</span>
                  <span>•</span>
                </>
              )}
              <Badge variant="outline" className="bg-background/50">
                {getSchoolTypeLabel(schoolInfo?.school_type || '')}
              </Badge>
              <span>•</span>
              <span className="text-sm flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Active
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {/* <Button className="bg-primary hover:bg-primary/90 shadow-sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/5">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button> */}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-flow-col auto-cols-max justify-start overflow-x-auto p-1 sm:grid-flow-row sm:grid-cols-4 sm:justify-center">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="applications">Teacher Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Today's Tasks Overview */}
          <TodaysTasksOverview onNavigate={setActiveModule} />

          {/* Statistics Cards with Trends and Drill-Down */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatsCardWithTrends
              title="Total Students"
              value={stats.totalStudents}
              icon={<GraduationCap className="h-5 w-5 text-primary" />}
              color="text-primary"
              secondaryValue={{
                label: "Active",
                value: stats.activeStudents,
              }}
              onClick={() => handleStatClick('totalStudents')}
            />

            <StatsCardWithTrends
              title="Teaching Staff"
              value={stats.totalTeachers}
              icon={<Users className="h-5 w-5 text-accent" />}
              color="text-accent"
              description="Active teachers"
              onClick={() => handleStatClick('totalTeachers')}
            />

            <StatsCardWithTrends
              title="Classes"
              value={stats.totalClasses}
              icon={<BookOpen className="h-5 w-5 text-primary" />}
              color="text-primary"
              description="Active classes"
              onClick={() => handleStatClick('totalClasses')}
            />

            <StatsCardWithTrends
              title="Subjects"
              value={stats.totalSubjects}
              icon={<ClipboardList className="h-5 w-5 text-accent" />}
              color="text-accent"
              description="Curriculum subjects"
              onClick={() => handleStatClick('totalSubjects')}
            />

            <StatsCardWithTrends
              title="Recent Admissions"
              value={stats.recentAdmissions}
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              color="text-primary"
              description="Last 30 days"
              onClick={() => handleStatClick('recentAdmissions')}
            />

            <Card 
              onClick={() => setActiveModule?.('reports')}
              className="relative overflow-hidden hover:shadow-elegant transition-all duration-300 group cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/10 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Analytics</CardTitle>
                <div className="p-2 bg-accent/10 rounded-lg group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-5 w-5 text-accent" />
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={(e) => { e.stopPropagation(); setActiveModule?.('reports'); }} variant="outline" className="w-full hover:bg-accent/5 hover:border-accent/30">
                  <FileText className="w-4 h-4 mr-2" />
                  View Reports
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Activity Feed */}
          <EnhancedActivityFeed />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceManagement />
        </TabsContent>

        <TabsContent value="exams">
          <ExamManagement />
        </TabsContent>

        <TabsContent value="applications">
          <TeacherApplicationsManager />
        </TabsContent>
      </Tabs>

      {/* Stats Detail Modal */}
      <StatsDetailModal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        statType={selectedStatType}
        data={statsModalData}
      />
    </div>
  );
};

export default SchoolAdminDashboard;
