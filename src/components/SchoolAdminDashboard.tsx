import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolStats } from "@/hooks/useSchoolStats";
import { useToast } from "@/hooks/use-toast";
import { PendingAssignmentCard } from "@/components/PendingAssignmentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/ui/skeleton-loader";
import { TeacherApplicationsManager } from "@/components/TeacherApplicationsManager";
import { AttendanceManagement } from "@/components/AttendanceManagement";
import { ExamManagement } from "@/components/ExamManagement";
import { EnhancedActivityFeed } from "@/components/SchoolAdmin/EnhancedActivityFeed";
import { TodaysTasksOverview } from "@/components/SchoolAdmin/TodaysTasksOverview";
import { StatsCardWithTrends } from "@/components/SchoolAdmin/StatsCardWithTrends";
import { StatsDetailModal } from "@/components/SchoolAdmin/StatsDetailModal";
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

interface SchoolStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  recentAdmissions: number;
}

interface SchoolAdminDashboardProps {
  setActiveModule?: (moduleId: string) => void;
}

const SchoolAdminDashboard = ({ setActiveModule }: SchoolAdminDashboardProps) => {
  const { profile } = useAuth();
  const fetchSchoolStats = useSchoolStats();
  const [stats, setStats] = useState<SchoolStats>({
    totalStudents: 0,
    activeStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalSubjects: 0,
    recentAdmissions: 0,
  });
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  
  // Modal state for stats drill-down
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedStatType, setSelectedStatType] = useState<string | null>(null);
  const [statsModalData, setStatsModalData] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.school_id) {
      fetchDashboardData();
    }
  }, [profile?.school_id]);

  const fetchDashboardData = async () => {
    if (!profile?.school_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch school info
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', profile.school_id)
        .single();

      if (schoolError) throw schoolError;
      setSchoolInfo(school);

      // Fetch all dashboard stats using consolidated RPC function
      const statsData = await fetchSchoolStats(profile.school_id);
      setStats(statsData);

      // Fetch recent activities (recent students)
      const { data: recentStudents, error: studentsError } = await supabase
        .from('students')
        .select('full_name, admission_date, class_id, classes(name)')
        .eq('school_id', profile.school_id)
        .order('admission_date', { ascending: false })
        .limit(5);

      if (studentsError) throw studentsError;
      setRecentActivities(recentStudents || []);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

      let data: any[] = [];

      switch (statType) {
        case 'totalStudents':
          const { data: allStudents } = await supabase
            .from('students')
            .select('id, full_name, student_id, class_id, status, admission_date, classes(name)')
            .eq('school_id', profile.school_id)
            .order('admission_date', { ascending: false });
          data = allStudents || [];
          break;

        case 'activeStudents':
          const { data: active } = await supabase
            .from('students')
            .select('id, full_name, student_id, class_id, status, admission_date, classes(name)')
            .eq('school_id', profile.school_id)
            .eq('status', 'active')
            .order('admission_date', { ascending: false });
          data = active || [];
          break;

        case 'totalTeachers':
          const { data: teachers } = await supabase
            .from('teachers')
            .select('id, full_name, email, phone, is_active, created_at')
            .eq('school_id', profile.school_id)
            .order('created_at', { ascending: false });
          data = teachers || [];
          break;

        case 'totalClasses':
          const { data: classes } = await supabase
            .from('classes')
            .select('id, name, section, is_active, created_at')
            .eq('school_id', profile.school_id)
            .order('name', { ascending: true });
          data = classes || [];
          break;

        case 'totalSubjects':
          const { data: subjects } = await supabase
            .from('subjects')
            .select('id, name, is_active, created_at')
            .eq('school_id', profile.school_id)
            .order('name', { ascending: true });
          data = subjects || [];
          break;

        case 'recentAdmissions':
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const { data: recent } = await supabase
            .from('students')
            .select('id, full_name, student_id, class_id, status, admission_date, classes(name)')
            .eq('school_id', profile.school_id)
            .eq('status', 'active')
            .gte('admission_date', thirtyDaysAgo.toISOString())
            .order('admission_date', { ascending: false });
          data = recent || [];
          break;
      }

      setStatsModalData(data);
      setStatsModalOpen(true);
    } catch (error: any) {
      console.error('Error fetching drill-down data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load detailed data',
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
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
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
        <TabsList className="grid w-full grid-cols-4">
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
