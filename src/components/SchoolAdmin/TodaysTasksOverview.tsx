import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  Calendar,
  Users,
  CheckSquare,
  BookOpen,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface TodaysTasks {
  pendingAttendance: number;
  scheduledExams: number;
  newAdmissions: number;
  pendingApplications: number;
}

interface TodaysTasksCardProps {
  onNavigate?: (module: string) => void;
}

export function TodaysTasksOverview({ onNavigate }: TodaysTasksCardProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TodaysTasks>({
    pendingAttendance: 0,
    scheduledExams: 0,
    newAdmissions: 0,
    pendingApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchTodaysTasks = useCallback(async () => {
    if (!profile?.school_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const weekLaterStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      if (isPhpBackend) {
        const [classesCount, examsCount, admissionsCount, applicationsCount] = await Promise.all([
          phpApi.table('classes').count({
            school_id: profile.school_id,
            is_active: 1,
          }),
          phpApi.table('exams').count({
            school_id: profile.school_id,
            is_active: 1,
            exam_date__gte: todayStr,
            exam_date__lte: weekLaterStr,
          }),
          phpApi.table('students').count({
            school_id: profile.school_id,
            status: 'active',
            admission_date__gte: todayStr,
          }),
          phpApi.table('teacher_applications').count({
            school_id: profile.school_id,
            status: 'pending',
          }),
        ]);

        setTasks({
          pendingAttendance: classesCount.count,
          scheduledExams: examsCount.count,
          newAdmissions: admissionsCount.count,
          pendingApplications: applicationsCount.count,
        });
        return;
      }

      // Get pending attendance records (classes without attendance marked today)
      const attendanceData = await apiClient
        .from('classes')
        .select('id')
        .eq('school_id', profile.school_id)
        .eq('is_active', true);
      const pendingAttendanceCount = (attendanceData.data?.length || 0);

      // Get scheduled exams for today and this week
      const examsData = await apiClient
        .from('exams')
        .select('id')
        .eq('school_id', profile.school_id)
        .eq('is_active', true)
        .gte('exam_date', todayStr)
        .lte('exam_date', weekLaterStr);
      const examsCount = (examsData.data?.length || 0);

      // Get new admissions today
      const admissionsData = await apiClient
        .from('students')
        .select('id')
        .eq('school_id', profile.school_id)
        .eq('status', 'active')
        .gte('admission_date', todayStr);
      const admissionsCount = (admissionsData.data?.length || 0);

      // Get pending teacher applications
      const applicationsResp = await apiClient
        .from('teacher_applications')
        .select('id');
      const applicationsData = applicationsResp;
      const applicationsCount = (applicationsData.data?.length || 0);

      setTasks({
        pendingAttendance: pendingAttendanceCount,
        scheduledExams: examsCount,
        newAdmissions: admissionsCount,
        pendingApplications: applicationsCount,
      });
    } catch (error: unknown) {
      console.error('Error fetching today\'s tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load today\'s tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, toast]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchTodaysTasks();
    }
  }, [profile?.school_id, fetchTodaysTasks]);

  const taskItems = [
    {
      id: 'attendance',
      title: 'Pending Attendance',
      count: tasks.pendingAttendance,
      icon: CheckSquare,
      color: 'text-orange-600 dark:text-orange-400 bg-orange-100/20 dark:bg-orange-900/20',
      badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200',
      urgency: tasks.pendingAttendance > 0 ? 'high' : 'low',
      action: () => onNavigate?.('attendance'),
    },
    {
      id: 'exams',
      title: 'Scheduled Exams',
      count: tasks.scheduledExams,
      icon: Calendar,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-100/20 dark:bg-blue-900/20',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
      urgency: tasks.scheduledExams > 0 ? 'medium' : 'low',
      action: () => onNavigate?.('exams'),
    },
    {
      id: 'admissions',
      title: 'New Admissions',
      count: tasks.newAdmissions,
      icon: Users,
      color: 'text-green-600 dark:text-green-400 bg-green-100/20 dark:bg-green-900/20',
      badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
      urgency: 'low',
      action: () => onNavigate?.('students'),
    },
    {
      id: 'applications',
      title: 'Pending Applications',
      count: tasks.pendingApplications,
      icon: BookOpen,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-100/20 dark:bg-purple-900/20',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
      urgency: tasks.pendingApplications > 0 ? 'high' : 'low',
      action: () => onNavigate?.('applications'),
    },
  ];

  const urgentTasks = taskItems.filter(item => item.urgency === 'high' && item.count > 0);
  const hasUrgentTasks = urgentTasks.length > 0;

  return (
    <Card className={`relative overflow-hidden transition-all ${
      hasUrgentTasks
        ? 'border-orange-200 dark:border-orange-800 shadow-md'
        : 'border-primary/10 shadow-sm'
    }`}>
      {/* Alert Banner if Urgent Tasks */}
      {hasUrgentTasks && (
        <div className="bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800 px-6 py-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
            {urgentTasks.reduce((sum, item) => sum + item.count, 0)} urgent task{urgentTasks.reduce((sum, item) => sum + item.count, 0) !== 1 ? 's' : ''} need your attention
          </p>
        </div>
      )}

      <CardHeader className={`bg-gradient-to-r ${
        hasUrgentTasks
          ? 'from-orange-50/50 dark:from-orange-950/20 to-transparent'
          : 'from-primary/5 to-transparent'
      }`}>
        <CardTitle className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${hasUrgentTasks ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-primary/10'}`}>
            <AlertCircle className={`h-5 w-5 ${hasUrgentTasks ? 'text-orange-600 dark:text-orange-400' : 'text-primary'}`} />
          </div>
          Today's Tasks
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskItems.map(item => {
              const Icon = item.icon;
              const isUrgent = item.urgency === 'high' && item.count > 0;

              return (
                <Button
                  key={item.id}
                  onClick={item.action}
                  variant="outline"
                  className={`h-auto p-4 flex flex-col items-start gap-3 transition-all group ${
                    isUrgent
                      ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Icon and Title Row */}
                  <div className="w-full flex items-start justify-between">
                    <div className={`p-2 rounded-lg ${item.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {isUrgent && (
                      <Badge className="bg-orange-600 dark:bg-orange-700 text-white text-xs">
                        Urgent
                      </Badge>
                    )}
                  </div>

                  {/* Title and Count */}
                  <div className="w-full text-left">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{item.title}</p>
                    <p className="text-2xl font-bold text-foreground">{item.count}</p>
                  </div>

                  {/* Action Hint */}
                  <div className="w-full flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    <span>View details</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </Button>
              );
            })}
          </div>
        )}

        {/* Summary Stats at Bottom */}
        {!loading && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Total Tasks:
              <span className="ml-2 font-semibold text-foreground">
                {tasks.pendingAttendance + tasks.scheduledExams + tasks.newAdmissions + tasks.pendingApplications}
              </span>
            </div>
            <div className="text-muted-foreground">
              Urgent:
              <span className={`ml-2 font-semibold ${hasUrgentTasks ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                {urgentTasks.reduce((sum, item) => sum + item.count, 0)} 
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
