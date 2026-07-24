import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QuickAttendanceSheet } from '@/components/QuickAttendanceSheet';
import { ClassPerformanceAnalytics } from '@/components/ClassPerformanceAnalytics';
import { PendingAssignmentCard } from '@/components/PendingAssignmentCard';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Calendar,
  ClipboardCheck,
  FileText,
  Clock,
  Award,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Target,
  Activity,
  Zap,
  BarChart3
} from 'lucide-react';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTeacherDashboardData, type TodayClass } from '@/hooks/useTeacherDashboardData';
import { DashboardRefreshStatus } from '@/components/DashboardRefreshStatus';
import { handleApiError } from '@/lib/api-error-handler';

const ExamMarksEntry = lazy(() =>
  import('@/components/ExamMarksEntry').then((module) => ({
    default: module.ExamMarksEntry,
  })),
);

// Swipeable Class Card Component
const SwipeableClassCard = ({ classItem, onSwipe, getClassStatusIcon, onTakeAttendance }: { 
  classItem: TodayClass; 
  onSwipe: (classItem: TodayClass, direction: 'left' | 'right') => void;
  getClassStatusIcon: (status: string) => JSX.Element;
  onTakeAttendance: (classItem: TodayClass) => void;
}) => {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwipingLeft, setIsSwipingLeft] = useState(false);
  const [isSwipingRight, setIsSwipingRight] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    setCurrentX(x);
    const diff = x - startX;
    
    if (Math.abs(diff) > 20) {
      setIsSwipingLeft(diff < -20);
      setIsSwipingRight(diff > 20);
    } else {
      setIsSwipingLeft(false);
      setIsSwipingRight(false);
    }
  };

  const handleTouchEnd = () => {
    const diff = currentX - startX;
    
    if (Math.abs(diff) > 100) {
      onSwipe(classItem, diff < 0 ? 'left' : 'right');
    }
    
    setStartX(0);
    setCurrentX(0);
    setIsSwipingLeft(false);
    setIsSwipingRight(false);
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe Actions Background */}
      <div className="absolute inset-0 flex">
        <div className={`flex-1 bg-primary flex items-center justify-start pl-4 transition-opacity duration-200 ${
          isSwipingRight ? 'opacity-100' : 'opacity-0'
        }`}>
          <ChevronRight className="h-6 w-6 text-primary-foreground" />
          <span className="text-primary-foreground font-medium ml-2">View Details</span>
        </div>
        <div className={`flex-1 bg-green-600 flex items-center justify-end pr-4 transition-opacity duration-200 ${
          isSwipingLeft ? 'opacity-100' : 'opacity-0'
        }`}>
          <span className="text-white font-medium mr-2">Take Attendance</span>
          <ChevronLeft className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Main Card Content */}
      <div 
        className={`relative bg-gradient-to-r from-card/80 to-card backdrop-blur-sm border border-border/50 rounded-xl shadow-sm transition-all duration-300 hover:shadow-elegant ${
          isSwipingLeft ? '-translate-x-2 shadow-lg' : isSwipingRight ? 'translate-x-2 shadow-lg' : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-4 flex-1">
            <div className={`p-2 rounded-full ${
              classItem.status === 'current' ? 'bg-green-600/10 text-green-600' :
              classItem.status === 'upcoming' ? 'bg-primary/10 text-primary' :
              'bg-muted-foreground/10 text-muted-foreground'
            }`}>
              {getClassStatusIcon(classItem.status)}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="font-semibold text-sm md:text-base text-foreground">{classItem.subject}</span>
                <Badge 
                  variant="secondary" 
                  className={`self-start text-xs px-2 py-1 ${
                    classItem.status === 'current' ? 'bg-green-600/10 text-green-600 border-green-600/20' :
                    classItem.status === 'upcoming' ? 'bg-primary/10 text-primary border-primary/20' :
                    'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20'
                  }`}
                >
                  {classItem.status}
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
                <span className="font-medium">{classItem.class}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {classItem.students} students
                </span>
                {classItem.room_number && (
                  <>
                    <span>•</span>
                    <span>Room {classItem.room_number}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div className="text-left">
              <p className="font-semibold text-sm md:text-base text-foreground">{classItem.time}</p>
              <p className="text-xs text-muted-foreground">Period Duration</p>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs touch-target hover:bg-green-600/10 hover:text-green-600 hover:border-green-600/30 transition-all duration-200"
                onClick={() => onTakeAttendance(classItem)}
              >
                <ClipboardCheck className="h-4 w-4 mr-1" />
                Attendance
              </Button>
              <Button 
                size="sm" 
                variant={classItem.status === 'current' ? 'default' : 'ghost'}
                className="text-xs touch-target hover-scale transition-all duration-200"
                onClick={() => onSwipe(classItem, 'right')}
              >
                {classItem.status === 'current' ? 'Join Now' : 'Details'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TeacherDashboardProps {
  setActiveModule?: (module: string) => void;
}

const TeacherDashboard = ({ setActiveModule }: TeacherDashboardProps) => {
  const { profile } = useAuth();
  const {
    stats,
    teacherInfo,
    schoolInfo,
    todayClasses,
    recentStudents,
    upcomingDeadlines,
    loading,
    error: dashboardError,
    refetch,
    fetching,
    lastUpdatedAt,
  } = useTeacherDashboardData(profile);
  const { toast } = useToast();
  
  // Mobile interaction states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusCheckRefreshing, setStatusCheckRefreshing] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [examMarksDialogOpen, setExamMarksDialogOpen] = useState(false);
  const [quickAttendanceOpen, setQuickAttendanceOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullToRefreshRef = useRef<HTMLDivElement>(null);

  // Mobile interactions
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        const scrolled = scrollRef.current.scrollTop > 100;
        setShowFab(scrolled);
      }
    };

    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Pull to refresh handler
  const handlePullToRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const result = await refetch();
      if (result.error) throw result.error;

      toast({
        title: "Dashboard Updated",
        description: "Latest data has been loaded",
      });
    } catch (error) {
      const notice = handleApiError('Refresh teacher dashboard', error, {
        context: { schoolId: profile?.school_id, userId: profile?.user_id },
        log: false,
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Swipe handler for class cards
  const handleClassSwipe = (classItem: TodayClass, direction: 'left' | 'right') => {
    if (direction === 'left') {
      // Quick action: Take attendance
      openQuickAttendance(classItem);
    } else if (direction === 'right') {
      // Quick action: View class details
      setActiveModule?.('classes');
      toast({
        title: "Opening Classes",
        description: `Viewing details for ${classItem.subject} - ${classItem.class}`,
      });
    }
  };

  const openQuickAttendance = (classItem: TodayClass) => {
    if (!classItem.class_id) {
      toast({
        title: "Cannot Take Attendance",
        description: "Class information is missing",
        variant: "destructive",
      });
      return;
    }

    setSelectedClassForAttendance({
      id: classItem.class_id,
      name: `${classItem.subject} - ${classItem.class}`,
    });
    setQuickAttendanceOpen(true);
  };

  useEffect(() => {
    if (!dashboardError) return;

    const notice = handleApiError('Load teacher dashboard', dashboardError, {
      context: { schoolId: profile?.school_id, userId: profile?.user_id },
      log: false,
    });

    toast({
      title: notice.title,
      description: notice.description,
      variant: "destructive",
    });
  }, [dashboardError, profile?.school_id, profile?.user_id, toast]);

  // Show pending approval screen if teacher is not approved yet
  if (profile?.approval_status === 'pending' || !profile?.school_id) {
    const handleRefreshStatus = async () => {
      setStatusCheckRefreshing(true);
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
        setStatusCheckRefreshing(false);
      }
    };

    return (
      <PendingAssignmentCard
        type="teacher"
        fullName={profile?.full_name || 'User'}
        applicationDate={profile?.created_at || new Date().toISOString()}
        approvalStatus={profile?.approval_status || 'pending'}
        applicationId={profile?.user_id}
        onRefresh={handleRefreshStatus}
        isRefreshing={statusCheckRefreshing}
      />
    );
  }

  const getSchoolTypeLabel = (type: string) => {
    switch (type) {
      case 'bangla_medium':
        return 'বাংলা মাধ্যম';
      case 'english_medium':
        return 'English Medium';
      case 'madrasha':
        return 'মাদ্রাসা';
      default:
        return type;
    }
  };

  const getClassStatusIcon = (status: string) => {
    switch (status) {
      case 'current':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'upcoming':
        return <Clock className="h-4 w-4 text-primary" />;
      case 'completed':
        return <Award className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-warning" />;
    }
  };

  const getClassStatusColor = (status: string) => {
    switch (status) {
      case 'current':
        return 'bg-green-600/10 text-green-600';
      case 'upcoming':
        return 'bg-primary/10 text-primary';
      case 'completed':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-warning/10 text-warning';
    }
  };

  if (loading) {
    return (
      <div className="p-3 md:p-6">
        <div className="animate-pulse">
          <div className="h-6 md:h-8 bg-muted rounded w-2/3 md:w-1/3 mb-4 md:mb-6"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 md:h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto">
      {/* Pull to Refresh Indicator */}
      <div 
        ref={pullToRefreshRef}
        className={`fixed top-0 left-0 right-0 z-50 bg-primary/90 text-primary-foreground text-center py-2 transition-transform duration-300 ${
          isRefreshing ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">
            {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      <div 
        className="p-2 md:p-6 space-y-4 md:space-y-8"
        onTouchStart={(e) => {
          if (scrollRef.current && scrollRef.current.scrollTop === 0) {
            const startY = e.touches[0]?.clientY;
            if (!startY) return;
            
            const handleTouchMove = (moveE: TouchEvent) => {
              const currentY = moveE.touches[0]?.clientY;
              if (!currentY) return;
              
              const diff = currentY - startY;
              if (diff > 100 && !isRefreshing) {
                handlePullToRefresh();
                document.removeEventListener('touchmove', handleTouchMove);
              }
            };
            
            const cleanup = () => {
              document.removeEventListener('touchmove', handleTouchMove);
            };
            
            document.addEventListener('touchmove', handleTouchMove, { passive: true });
            document.addEventListener('touchend', cleanup, { once: true });
          }
        }}
      >
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-xl md:rounded-2xl -z-10"></div>
        <div className="flex flex-col gap-3 p-4 md:p-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 md:mb-2">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-full">
                <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Teacher Portal
              </h1>
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-base md:text-xl text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{profile?.full_name || 'Teacher'}</span>
              </p>
              {schoolInfo && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 mt-1.5 md:mt-2">
                  <span className="text-xs md:text-sm text-muted-foreground font-medium">{schoolInfo.name}</span>
                  <Badge variant="secondary" className="self-start text-xs bg-primary/10 text-primary border-primary/20">
                    {getSchoolTypeLabel(schoolInfo.school_type)}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <DashboardRefreshStatus
            updatedAt={lastUpdatedAt}
            fetching={fetching}
            onRefresh={refetch}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4 md:space-y-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card 
          className="group relative overflow-hidden border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-primary/5 via-card to-primary/3 cursor-pointer"
          onClick={() => setActiveModule?.('classes')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 relative z-10 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground">My Classes</CardTitle>
            <div className="p-1.5 md:p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors duration-300">
              <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 md:p-6 pt-0">
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <div className="text-2xl md:text-4xl font-bold text-primary">{stats.myClasses}</div>
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
              Classes assigned to you
            </p>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-accent/5 via-card to-accent/3 cursor-pointer"
          onClick={() => setActiveModule?.('students')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 relative z-10 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground">Total Students</CardTitle>
            <div className="p-1.5 md:p-2 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors duration-300">
              <GraduationCap className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 md:p-6 pt-0">
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <div className="text-2xl md:text-4xl font-bold text-accent">{stats.totalStudents}</div>
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-500" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
              Students in your classes
            </p>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-green-500/5 via-card to-green-500/3 cursor-pointer"
          onClick={() => setActiveModule?.('subjects')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 relative z-10 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground">My Subjects</CardTitle>
            <div className="p-1.5 md:p-2 bg-green-500/10 rounded-full group-hover:bg-green-500/20 transition-colors duration-300">
              <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 md:p-6 pt-0">
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <div className="text-2xl md:text-4xl font-bold text-green-600">{stats.mySubjects}</div>
              <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-500" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
              Subjects you teach
            </p>
          </CardContent>
        </Card>

        <Card 
          className="group relative overflow-hidden border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-orange-500/5 via-card to-orange-500/3 cursor-pointer"
          onClick={() => setActiveModule?.('attendance')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 relative z-10 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground">Pending Tasks</CardTitle>
            <div className="p-1.5 md:p-2 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors duration-300">
              <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 md:p-6 pt-0">
            <div className="flex items-baseline gap-1.5 md:gap-2">
              <div className="text-2xl md:text-4xl font-bold text-orange-600">{stats.pendingTasks}</div>
              <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-orange-500" />
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2">
              Tasks requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Tasks Overview */}
      <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-orange-500/5 via-card to-orange-500/3">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-orange-500/5 to-orange-500/10 p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 md:gap-3 text-sm md:text-lg">
            <div className="p-1.5 md:p-2 bg-orange-500/10 rounded-full">
              <CheckCircle className="h-3.5 w-3.5 md:h-5 md:w-5 text-orange-500" />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Today's Tasks
            </span>
            <Badge variant="secondary" className="ml-auto bg-orange-500/10 text-orange-600">
              {stats.pendingTasks} pending
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3">
            {/* Pending Attendance */}
            {stats.pendingTasks > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg hover:bg-orange-500/10 transition-colors cursor-pointer"
                onClick={() => setActiveModule?.('attendance')}>
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Attendance Pending</p>
                  <p className="text-xs text-muted-foreground">{stats.pendingTasks} class{stats.pendingTasks > 1 ? 'es' : ''} need attendance marked</p>
                </div>
                <Button size="sm" variant="ghost" className="text-orange-500 hover:bg-orange-500/10">
                  Mark Now
                </Button>
              </div>
            )}
            
            {/* Today's Classes Summary */}
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
              onClick={() => {
                const upcomingClass = todayClasses.find(c => c.status === 'upcoming' || c.status === 'current');
                if (upcomingClass) {
                  openQuickAttendance(upcomingClass);
                }
              }}>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Today's Classes</p>
                <p className="text-xs text-muted-foreground">
                  {todayClasses.filter(c => c.status === 'current').length > 0 
                    ? `${todayClasses.filter(c => c.status === 'current')[0].subject} is happening now`
                    : todayClasses.filter(c => c.status === 'upcoming').length > 0
                    ? `Next: ${todayClasses.filter(c => c.status === 'upcoming')[0].subject} at ${todayClasses.filter(c => c.status === 'upcoming')[0].time.split('-')[0]}`
                    : `${todayClasses.length} classes completed`}
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {todayClasses.length}
              </Badge>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg text-center">
                <CheckCircle className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-600">{todayClasses.filter(c => c.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-center">
                <Clock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-600">{todayClasses.filter(c => c.status === 'current').length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg text-center">
                <Activity className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-purple-600">{todayClasses.filter(c => c.status === 'upcoming').length}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        {/* Today's Schedule */}
        <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-card via-card/95 to-primary/5">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5 p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 md:gap-3 text-sm md:text-lg">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-full">
                <Calendar className="h-3.5 w-3.5 md:h-5 md:w-5 text-primary" />
              </div>
              <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Today's Schedule
              </span>
              <Badge variant="secondary" className="ml-auto bg-primary/10 text-primary">
                {todayClasses.length} classes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {todayClasses.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-full blur-2xl"></div>
                  <div className="relative p-6 bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl border border-border/50">
                    <BookOpen className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Classes Today</h3>
                    <p className="text-sm text-muted-foreground mb-4">Enjoy your free day or catch up on preparation</p>
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border/50">
                      💡 Tip: Use swipe gestures on class cards - left for attendance, right for details
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden md:flex items-center justify-between text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
                  <span>💡 Pro tip: Swipe class cards for quick actions</span>
                  <span>← Attendance | Details →</span>
                </div>
                {todayClasses.map((classItem, index) => (
                  <SwipeableClassCard
                    key={index}
                    classItem={classItem}
                    onSwipe={handleClassSwipe}
                    getClassStatusIcon={getClassStatusIcon}
                    onTakeAttendance={openQuickAttendance}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Students & Quick Actions Combined */}
        <div className="space-y-4 md:space-y-6">
          {/* Recent Students */}
          {recentStudents.length > 0 && (
            <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-card via-card/95 to-blue-500/5">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-blue-500/10 p-3 md:p-4">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <div className="p-1.5 bg-blue-500/10 rounded-full">
                    <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-500" />
                  </div>
                  <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Recent Students
                  </span>
                  <Badge variant="secondary" className="ml-auto bg-blue-500/10 text-blue-600 text-xs">
                    {recentStudents.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-4">
                <div className="space-y-2">
                  {recentStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 p-2 md:p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer border border-border/50"
                      onClick={() => setActiveModule?.('students')}
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {student.full_name?.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-semibold text-foreground truncate">
                          {student.full_name}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground">
                          {student.classes?.name} {student.classes?.section} • ID: {student.student_id}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] md:text-xs">
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-card via-card/95 to-red-500/5">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-red-500/5 to-red-500/10 p-3 md:p-4">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <div className="p-1.5 bg-red-500/10 rounded-full">
                    <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-500" />
                  </div>
                  <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Upcoming Exams
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-4">
                <div className="space-y-2">
                  {upcomingDeadlines.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex items-center gap-3 p-2 md:p-3 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border border-red-500/20"
                      onClick={() => setActiveModule?.('exams')}
                    >
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <FileText className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-semibold text-foreground truncate">
                          {exam.name}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground">
                          {new Date(exam.exam_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] md:text-xs">
                        {Math.ceil((new Date(exam.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-card via-card/95 to-accent/5">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-accent/5 to-primary/5 p-3 md:p-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-sm md:text-lg">
                <div className="p-1.5 md:p-2 bg-accent/10 rounded-full">
                  <Zap className="h-3.5 w-3.5 md:h-5 md:w-5 text-accent" />
                </div>
                <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  Quick Actions
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <div className="grid grid-cols-2 gap-2.5 md:gap-4">
              <Button 
                variant="outline" 
                className="group h-auto p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 touch-target hover:bg-primary/5 hover:border-primary/30 border-border/50 bg-gradient-to-br from-card to-primary/5 shadow-sm hover:shadow-elegant transition-all duration-300"
                onClick={() => setActiveModule?.('attendance')}
              >
                <div className="p-2 md:p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors duration-300">
                  <ClipboardCheck className="h-4 w-4 md:h-6 md:w-6 text-primary" />
                </div>
                <span className="text-[10px] md:text-sm font-medium text-center leading-tight">Take Attendance</span>
              </Button>
              <Button 
                variant="outline" 
                className="group h-auto p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 touch-target hover:bg-accent/5 hover:border-accent/30 border-border/50 bg-gradient-to-br from-card to-accent/5 shadow-sm hover:shadow-elegant transition-all duration-300"
                onClick={() => setActiveModule?.('exams')}
              >
                <div className="p-2 md:p-3 bg-accent/10 rounded-full group-hover:bg-accent/20 transition-colors duration-300">
                  <FileText className="h-4 w-4 md:h-6 md:w-6 text-accent" />
                </div>
                <span className="text-[10px] md:text-sm font-medium text-center leading-tight">Grade Assignments</span>
              </Button>
              <Button 
                variant="outline" 
                className="group h-auto p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 touch-target hover:bg-green-500/5 hover:border-green-500/30 border-border/50 bg-gradient-to-br from-card to-green-500/5 shadow-sm hover:shadow-elegant transition-all duration-300"
                onClick={() => setActiveModule?.('exam-marks')}
              >
                <div className="p-2 md:p-3 bg-green-500/10 rounded-full group-hover:bg-green-500/20 transition-colors duration-300">
                  <Award className="h-4 w-4 md:h-6 md:w-6 text-green-500" />
                </div>
                <span className="text-[10px] md:text-sm font-medium text-center leading-tight">Enter Exam Marks</span>
              </Button>
              <Button 
                variant="outline" 
                className="group h-auto p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 touch-target hover:bg-blue-500/5 hover:border-blue-500/30 border-border/50 bg-gradient-to-br from-card to-blue-500/5 shadow-sm hover:shadow-elegant transition-all duration-300"
                onClick={() => setActiveModule?.('students')}
              >
                <div className="p-2 md:p-3 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors duration-300">
                  <Users className="h-4 w-4 md:h-6 md:w-6 text-blue-500" />
                </div>
                <span className="text-[10px] md:text-sm font-medium text-center leading-tight">View Students</span>
              </Button>
              <Button 
                variant="outline" 
                className="group h-auto p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 touch-target hover:bg-purple-500/5 hover:border-purple-500/30 border-border/50 bg-gradient-to-br from-card to-purple-500/5 shadow-sm hover:shadow-elegant transition-all duration-300"
                onClick={() => setActiveModule?.('classes')}
              >
                <div className="p-2 md:p-3 bg-purple-500/10 rounded-full group-hover:bg-purple-500/20 transition-colors duration-300">
                  <BookOpen className="h-4 w-4 md:h-6 md:w-6 text-purple-500" />
                </div>
                <span className="text-[10px] md:text-sm font-medium text-center leading-tight">Lesson Plans</span>
              </Button>
              <Button 
                variant="outline" 
                className="group h-auto p-3 md:p-5 flex flex-col items-center gap-1.5 md:gap-3 touch-target hover:bg-orange-500/5 hover:border-orange-500/30 border-border/50 bg-gradient-to-br from-card to-orange-500/5 shadow-sm hover:shadow-elegant transition-all duration-300"
                onClick={() => setActiveModule?.('timetable')}
              >
                <div className="p-2 md:p-3 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors duration-300">
                  <Calendar className="h-4 w-4 md:h-6 md:w-6 text-orange-500" />
                </div>
                <span className="text-[10px] md:text-sm font-medium text-center leading-tight">Schedule</span>
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Performance Analytics */}
      <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-card via-card/95 to-indigo-500/5">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 md:gap-3 text-sm md:text-lg">
            <div className="p-1.5 md:p-2 bg-indigo-500/10 rounded-full">
              <BarChart3 className="h-3.5 w-3.5 md:h-5 md:w-5 text-indigo-500" />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Performance Analytics
            </span>
            <Badge variant="secondary" className="ml-auto bg-indigo-500/10 text-indigo-600 text-xs">
              Live Data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <ClassPerformanceAnalytics />
        </CardContent>
      </Card>

      {/* Teacher Profile */}
      {teacherInfo && (
        <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-card via-card/95 to-primary/3">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/3 to-accent/3">
            <CardTitle className="flex items-center gap-3 text-base md:text-lg">
              <div className="p-2 bg-primary/10 rounded-full">
                <GraduationCap className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Professional Profile
              </span>
              <Badge variant="secondary" className="ml-auto bg-green-500/10 text-green-600">
                Active Teacher
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Teacher ID</p>
                <p className="text-sm md:text-base font-mono bg-muted/50 px-3 py-2 rounded-lg border border-border/50">{teacherInfo?.teacher_id || 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Designation</p>
                <p className="text-sm md:text-base font-medium">{teacherInfo?.designation || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject Specialization</p>
                <p className="text-sm md:text-base font-medium">{teacherInfo?.subject_specialization || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qualification</p>
                <p className="text-sm md:text-base font-medium">{teacherInfo?.qualification || 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Joining Date</p>
                <p className="text-sm md:text-base font-medium">{teacherInfo?.joining_date ? new Date(teacherInfo.joining_date).toLocaleDateString() : 'Not specified'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</p>
                <p className="text-sm md:text-base font-mono bg-muted/50 px-3 py-2 rounded-lg border border-border/50">{teacherInfo?.phone || 'Not provided'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Action Button for Mobile */}
      <div 
        className={`fixed bottom-6 right-6 z-50 md:hidden transition-all duration-300 ${
          showFab ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
          onClick={() => {
            setActiveModule?.('attendance');
            toast({
              title: "Quick Action",
              description: "Opening attendance management",
            });
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Quick Attendance Sheet */}
      <QuickAttendanceSheet
        open={quickAttendanceOpen}
        onOpenChange={setQuickAttendanceOpen}
        classId={selectedClassForAttendance?.id}
        className={selectedClassForAttendance?.name}
        date={new Date()}
      />

      {/* Quick Attendance Sheet */}
      <QuickAttendanceSheet
        open={quickAttendanceOpen}
        onOpenChange={setQuickAttendanceOpen}
        classId={selectedClassForAttendance?.id}
        className={selectedClassForAttendance?.name}
        date={new Date()}
      />

      {/* Exam Marks Entry Dialog */}
      <Dialog open={examMarksDialogOpen} onOpenChange={setExamMarksDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 md:p-6 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Award className="h-5 w-5 text-green-500" />
              Enter Exam Marks
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 md:p-6">
            <Suspense fallback={<p className="py-8 text-center text-sm text-muted-foreground">Loading marks entry...</p>}>
              <ExamMarksEntry onComplete={() => setExamMarksDialogOpen(false)} />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </div>
  );
};

export default TeacherDashboard;
