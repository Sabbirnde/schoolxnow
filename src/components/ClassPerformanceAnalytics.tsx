import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { apiClient } from '@/integrations/php-api/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  Calendar,
  Award,
  Minus,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface PerformanceMetrics {
  attendanceRate: number;
  attendanceTrend: 'up' | 'down' | 'stable';
  averageGrade: number;
  gradeTrend: 'up' | 'down' | 'stable';
  totalStudents: number;
  activeStudents: number;
  atRiskStudents: number;
  topPerformers: number;
}

interface AttendanceData {
  date: string;
  present: number;
  total: number;
  rate: number;
}

interface GradeDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface ClassPerformanceProps {
  classId?: string;
  subjectId?: string;
  dateRange?: { start: Date; end: Date };
}

interface StudentAnalyticsRow {
  id: string;
  class_id: string | null;
  status: string;
}

interface AttendanceAnalyticsRow {
  id?: string;
  class_id: string;
  date: string;
  is_present: boolean | number | null;
}

interface ExamResultAnalyticsRow {
  student_id: string;
  subject_id: string;
  obtained_marks: number;
  total_marks: number;
}

interface TeacherAnalyticsRow {
  id: string;
}

interface TimetableAnalyticsRow {
  class_id: string;
}

const PHP_PAGE_SIZE = 200;

async function phpListAll<T extends object>(
  table: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
  sort = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const page = await phpApi.table<T>(table).list({
      ...params,
      sort,
      order,
      limit: PHP_PAGE_SIZE,
      offset,
    });

    rows.push(...page);
    if (page.length < PHP_PAGE_SIZE) break;
    offset += PHP_PAGE_SIZE;
  }

  return rows;
}

function isTruthy(value: boolean | number | string | null | undefined) {
  return value === true || value === 1 || value === '1';
}

function markPercentage(result: Pick<ExamResultAnalyticsRow, 'obtained_marks' | 'total_marks'>) {
  return result.total_marks > 0 ? (result.obtained_marks / result.total_marks) * 100 : 0;
}

export function ClassPerformanceAnalytics({ classId, subjectId, dateRange }: ClassPerformanceProps) {
  const { profile } = useAuth();
  const { canFull } = useFeatureAccess();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    attendanceRate: 0,
    attendanceTrend: 'stable',
    averageGrade: 0,
    gradeTrend: 'stable',
    totalStudents: 0,
    activeStudents: 0,
    atRiskStudents: 0,
    topPerformers: 0,
  });
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceData[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);

  const fetchAnalytics = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      setLoading(true);

      if (isPhpBackend) {
        let teacherClassIds: string[] = [];
        if (!canFull('analytics.view')) {
          const teachers = await phpListAll<TeacherAnalyticsRow>('teachers', {
            school_id: profile.school_id,
            user_id: profile.user_id,
          });
          const teacher = teachers[0];

          if (teacher) {
            const timetableData = await phpListAll<TimetableAnalyticsRow>('timetable', {
              school_id: profile.school_id,
              teacher_id: teacher.id,
            });
            teacherClassIds = [...new Set(timetableData.map(t => t.class_id))];
          }
        }

        const targetClassIds = classId
          ? [classId]
          : !canFull('analytics.view')
          ? teacherClassIds
          : [];

        if (targetClassIds.length === 0 && !canFull('analytics.view')) {
          setLoading(false);
          return;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = dateRange?.start || thirtyDaysAgo;
        const endDate = dateRange?.end || new Date();
        const startDateString = startDate.toISOString().split('T')[0];
        const endDateString = endDate.toISOString().split('T')[0];

        const [studentRows, attendanceRows, examResultRows] = await Promise.all([
          phpListAll<StudentAnalyticsRow>('students', {
            school_id: profile.school_id,
          }),
          phpListAll<AttendanceAnalyticsRow>('attendance', {
            school_id: profile.school_id,
            date__gte: startDateString,
            date__lte: endDateString,
            ...(classId ? { class_id: classId } : {}),
          }, 'date', 'asc'),
          phpListAll<ExamResultAnalyticsRow>('exam_results', {
            school_id: profile.school_id,
            ...(subjectId ? { subject_id: subjectId } : {}),
          }),
        ]);

        const targetClassSet = new Set(targetClassIds);
        const students = targetClassIds.length > 0
          ? studentRows.filter(student => student.class_id && targetClassSet.has(student.class_id))
          : studentRows;
        const totalStudents = students.length;
        const activeStudents = students.filter(s => s.status === 'active').length;
        const attendanceData = targetClassIds.length > 0
          ? attendanceRows.filter(record => targetClassSet.has(record.class_id))
          : attendanceRows;

        const totalAttendanceRecords = attendanceData.length;
        const presentRecords = attendanceData.filter(a => isTruthy(a.is_present)).length;
        const attendanceRate = totalAttendanceRecords > 0
          ? (presentRecords / totalAttendanceRecords) * 100
          : 0;

        const attendanceByDate = new Map<string, { present: number; total: number }>();
        attendanceData.forEach(record => {
          const date = record.date;
          const current = attendanceByDate.get(date) || { present: 0, total: 0 };
          current.total += 1;
          if (isTruthy(record.is_present)) current.present += 1;
          attendanceByDate.set(date, current);
        });

        const attendanceHistory = Array.from(attendanceByDate.entries())
          .map(([date, data]) => ({
            date,
            present: data.present,
            total: data.total,
            rate: (data.present / data.total) * 100,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-14);

        let attendanceTrend: 'up' | 'down' | 'stable' = 'stable';
        if (attendanceHistory.length >= 7) {
          const recentAvg = attendanceHistory.slice(-7).reduce((sum, d) => sum + d.rate, 0) / 7;
          const previousAvg = attendanceHistory.slice(0, 7).reduce((sum, d) => sum + d.rate, 0) / 7;
          const diff = recentAvg - previousAvg;
          if (diff > 5) attendanceTrend = 'up';
          else if (diff < -5) attendanceTrend = 'down';
        }

        const targetStudentIds = new Set(students.map(s => s.id));
        const filteredResults = examResultRows.filter(r => targetStudentIds.has(r.student_id));
        const totalMarks = filteredResults.reduce((sum, result) => sum + markPercentage(result), 0);
        const averageGrade = filteredResults.length > 0
          ? totalMarks / filteredResults.length
          : 0;

        const gradeRanges = [
          { range: '90-100', min: 90, max: 100, count: 0 },
          { range: '80-89', min: 80, max: 89, count: 0 },
          { range: '70-79', min: 70, max: 79, count: 0 },
          { range: '60-69', min: 60, max: 69, count: 0 },
          { range: '50-59', min: 50, max: 59, count: 0 },
          { range: '<50', min: 0, max: 49, count: 0 },
        ];

        filteredResults.forEach(result => {
          const percentage = markPercentage(result);
          const range = gradeRanges.find(r => percentage >= r.min && percentage <= r.max);
          if (range) range.count++;
        });

        const gradeDistribution = gradeRanges.map(r => ({
          range: r.range,
          count: r.count,
          percentage: filteredResults.length > 0 ? (r.count / filteredResults.length) * 100 : 0,
        }));

        const studentGrades = new Map<string, number[]>();
        filteredResults.forEach(result => {
          const grades = studentGrades.get(result.student_id) || [];
          grades.push(markPercentage(result));
          studentGrades.set(result.student_id, grades);
        });

        const studentAverages = Array.from(studentGrades.entries()).map(([studentId, grades]) => ({
          studentId,
          average: grades.reduce((sum, grade) => sum + grade, 0) / grades.length,
        }));

        setMetrics({
          attendanceRate: Math.round(attendanceRate * 10) / 10,
          attendanceTrend,
          averageGrade: Math.round(averageGrade * 10) / 10,
          gradeTrend: 'stable',
          totalStudents,
          activeStudents,
          atRiskStudents: studentAverages.filter(s => s.average < 50).length,
          topPerformers: studentAverages.filter(s => s.average >= 80).length,
        });

        setAttendanceHistory(attendanceHistory);
        setGradeDistribution(gradeDistribution);
        setError(null);
        return;
      }

      // Get teacher's classes if teacher role
      let teacherClassIds: string[] = [];
      if (!canFull('analytics.view')) {
        const { data: teacherData } = await apiClient
          .from('teachers')
          .select('id')
          .eq('user_id', profile.user_id)
          .single();

        if (teacherData) {
          const { data: timetableData } = await apiClient
            .from('timetable')
            .select('class_id')
            .eq('teacher_id', teacherData.id);

          teacherClassIds = [...new Set(timetableData?.map(t => t.class_id) || [])];
        }
      }

      // Determine which classes to analyze
      const targetClassIds = classId 
        ? [classId] 
        : !canFull('analytics.view') 
        ? teacherClassIds 
        : [];

      if (targetClassIds.length === 0 && !canFull('analytics.view')) {
        setLoading(false);
        return;
      }

      // Fetch students
      let studentsQuery = apiClient
        .from('students')
        .select('id, class_id, status')
        .eq('school_id', profile.school_id);

      if (targetClassIds.length > 0) {
        studentsQuery = studentsQuery.in('class_id', targetClassIds);
      }

      const { data: students } = await studentsQuery;
      const totalStudents = students?.length || 0;
      const activeStudents = students?.filter(s => s.status === 'active').length || 0;

      // Fetch attendance data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = dateRange?.start || thirtyDaysAgo;
      const endDate = dateRange?.end || new Date();

      let attendanceQuery = apiClient
        .from('attendance')
        .select('*')
        .eq('school_id', profile.school_id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (targetClassIds.length > 0) {
        attendanceQuery = attendanceQuery.in('class_id', targetClassIds);
      }

      const { data: attendanceData } = await attendanceQuery;

      // Calculate attendance rate
      const totalAttendanceRecords = attendanceData?.length || 0;
      const presentRecords = attendanceData?.filter(a => a.is_present).length || 0;
      const attendanceRate = totalAttendanceRecords > 0 
        ? (presentRecords / totalAttendanceRecords) * 100 
        : 0;

      // Calculate attendance by date for trend
      const attendanceByDate = new Map<string, { present: number; total: number }>();
      attendanceData?.forEach(record => {
        const date = record.date;
        const current = attendanceByDate.get(date) || { present: 0, total: 0 };
        current.total += 1;
        if (record.is_present) current.present += 1;
        attendanceByDate.set(date, current);
      });

      const attendanceHistory = Array.from(attendanceByDate.entries())
        .map(([date, data]) => ({
          date,
          present: data.present,
          total: data.total,
          rate: (data.present / data.total) * 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14); // Last 14 days

      // Calculate attendance trend
      let attendanceTrend: 'up' | 'down' | 'stable' = 'stable';
      if (attendanceHistory.length >= 7) {
        const recentAvg = attendanceHistory.slice(-7).reduce((sum, d) => sum + d.rate, 0) / 7;
        const previousAvg = attendanceHistory.slice(0, 7).reduce((sum, d) => sum + d.rate, 0) / 7;
        const diff = recentAvg - previousAvg;
        if (diff > 5) attendanceTrend = 'up';
        else if (diff < -5) attendanceTrend = 'down';
      }

      // Fetch exam results for grades
      let examResultsQuery = apiClient
        .from('exam_results')
        .select('obtained_marks, total_marks, student_id')
        .eq('school_id', profile.school_id);

      if (subjectId) {
        examResultsQuery = examResultsQuery.eq('subject_id', subjectId);
      }

      const { data: examResults } = await examResultsQuery;

      // Filter results for target students
      const targetStudentIds = students?.map(s => s.id) || [];
      const filteredResults = examResults?.filter(r => 
        targetStudentIds.includes(r.student_id)
      ) || [];

      // Calculate average grade
      const totalMarks = filteredResults.reduce((sum, r) => 
        sum + (r.obtained_marks / r.total_marks) * 100, 0
      );
      const averageGrade = filteredResults.length > 0 
        ? totalMarks / filteredResults.length 
        : 0;

      // Calculate grade distribution
      const gradeRanges = [
        { range: '90-100', min: 90, max: 100, count: 0 },
        { range: '80-89', min: 80, max: 89, count: 0 },
        { range: '70-79', min: 70, max: 79, count: 0 },
        { range: '60-69', min: 60, max: 69, count: 0 },
        { range: '50-59', min: 50, max: 59, count: 0 },
        { range: '<50', min: 0, max: 49, count: 0 },
      ];

      filteredResults.forEach(result => {
        const percentage = (result.obtained_marks / result.total_marks) * 100;
        const range = gradeRanges.find(r => percentage >= r.min && percentage <= r.max);
        if (range) range.count++;
      });

      const gradeDistribution = gradeRanges.map(r => ({
        range: r.range,
        count: r.count,
        percentage: filteredResults.length > 0 ? (r.count / filteredResults.length) * 100 : 0,
      }));

      // Identify at-risk and top performers
      const studentGrades = new Map<string, number[]>();
      filteredResults.forEach(result => {
        const percentage = (result.obtained_marks / result.total_marks) * 100;
        const grades = studentGrades.get(result.student_id) || [];
        grades.push(percentage);
        studentGrades.set(result.student_id, grades);
      });

      const studentAverages = Array.from(studentGrades.entries()).map(([studentId, grades]) => ({
        studentId,
        average: grades.reduce((sum, g) => sum + g, 0) / grades.length,
      }));

      const atRiskStudents = studentAverages.filter(s => s.average < 50).length;
      const topPerformers = studentAverages.filter(s => s.average >= 80).length;

      setMetrics({
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        attendanceTrend,
        averageGrade: Math.round(averageGrade * 10) / 10,
        gradeTrend: 'stable', // Could be calculated similar to attendance
        totalStudents,
        activeStudents,
        atRiskStudents,
        topPerformers,
      });

      setAttendanceHistory(attendanceHistory);
      setGradeDistribution(gradeDistribution);
      setError(null);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [profile?.school_id, profile?.user_id, classId, subjectId, dateRange, canFull]);

  useEffect(() => {
    if (profile?.school_id) {
      fetchAnalytics();
    }
  }, [profile?.school_id, fetchAnalytics]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable', inverse = false) => {
    if (trend === 'up') return inverse ? 'text-red-500' : 'text-green-500';
    if (trend === 'down') return inverse ? 'text-green-500' : 'text-red-500';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Error Loading Analytics</p>
              <p className="text-sm text-red-600/80">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no students
  if (metrics.totalStudents === 0) {
    return (
      <Card className="border-muted">
        <CardContent className="p-8">
          <div className="text-center space-y-2">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">No Student Data</p>
            <p className="text-sm text-muted-foreground">
              {!canFull('analytics.view') 
                ? 'No students found in your assigned classes. Please check your timetable assignments.'
                : 'No students found. Add students to see performance analytics.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-blue-500/5 via-card to-blue-500/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Attendance Rate
              {getTrendIcon(metrics.attendanceTrend)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-foreground">
                  {metrics.attendanceRate}%
                </div>
                {metrics.attendanceTrend !== 'stable' && (
                  <Badge variant="outline" className={`${
                    metrics.attendanceTrend === 'up' 
                      ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                      : 'bg-red-500/10 text-red-600 border-red-500/20'
                  } text-xs`}>
                    {metrics.attendanceTrend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Last 30 days average</p>
            </div>
          </CardContent>
        </Card>

        {/* Average Grade */}
        <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-green-500/5 via-card to-green-500/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Average Grade
              <Award className="h-4 w-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-foreground">
                  {metrics.averageGrade}%
                </div>
                <Badge variant="outline" className={`${
                  metrics.averageGrade >= 70 
                    ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                    : metrics.averageGrade >= 50
                    ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                } text-xs`}>
                  {metrics.averageGrade >= 70 ? 'Good' : metrics.averageGrade >= 50 ? 'Fair' : 'Needs Attention'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Class performance</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Students */}
        <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-purple-500/5 via-card to-purple-500/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Active Students
              <Users className="h-4 w-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-foreground">
                  {metrics.activeStudents}
                </div>
                <span className="text-sm text-muted-foreground">
                  / {metrics.totalStudents}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalStudents > 0 
                  ? `${Math.round((metrics.activeStudents / metrics.totalStudents) * 100)}% enrollment`
                  : 'No students'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* At-Risk Students */}
        <Card className="border-0 shadow-sm hover:shadow-elegant transition-all duration-300 bg-gradient-to-br from-orange-500/5 via-card to-orange-500/3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              At-Risk Students
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-foreground">
                  {metrics.atRiskStudents}
                </div>
                <Badge variant="outline" className={`${
                  metrics.atRiskStudents === 0 
                    ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                    : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                } text-xs`}>
                  {metrics.atRiskStudents === 0 ? 'All Good' : 'Needs Support'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Grades below 50%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-blue-500" />
              Attendance Trend (Last 14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceHistory.length > 0 ? (
              <div className="space-y-3">
                {attendanceHistory.map((day, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground w-20">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              day.rate >= 80 
                                ? 'bg-green-500' 
                                : day.rate >= 60 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${day.rate}%` }}
                          />
                        </div>
                        <div className="text-sm font-medium text-foreground w-12 text-right">
                          {Math.round(day.rate)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-16 text-right">
                      {day.present}/{day.total}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No attendance data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-green-500" />
              Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gradeDistribution.some(g => g.count > 0) ? (
              <div className="space-y-3">
                {gradeDistribution.map((grade, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="text-xs font-medium text-muted-foreground w-16">
                      {grade.range}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              grade.range.startsWith('9') || grade.range.startsWith('8')
                                ? 'bg-green-500' 
                                : grade.range.startsWith('7') || grade.range.startsWith('6')
                                ? 'bg-blue-500' 
                                : grade.range.startsWith('5')
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${grade.percentage}%` }}
                          />
                        </div>
                        <div className="text-sm font-medium text-foreground w-12 text-right">
                          {Math.round(grade.percentage)}%
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-16 text-right">
                      {grade.count} students
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No grade data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="h-5 w-5 text-primary" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-card rounded-lg border border-border/50">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {metrics.topPerformers}
              </div>
              <div className="text-sm text-muted-foreground">
                Top Performers (≥80%)
              </div>
            </div>
            <div className="p-4 bg-card rounded-lg border border-border/50">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {Math.max(0, metrics.activeStudents - metrics.atRiskStudents - metrics.topPerformers)}
              </div>
              <div className="text-sm text-muted-foreground">
                Average Performers (50-79%)
              </div>
            </div>
            <div className="p-4 bg-card rounded-lg border border-border/50">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {Math.round(metrics.attendanceRate) >= 80 ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">
                Attendance Target (≥80%)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
