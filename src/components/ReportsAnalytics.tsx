import { useState, useEffect, useCallback } from "react";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import { supabase } from "@/integrations/php-api/compat-client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Award, 
  Calendar,
  Download,
  FileText,
  Target,
  Trophy,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/api-error-handler";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  class_id: string;
  classes?: {
    name: string;
    section: string;
    class_level: string;
  };
}

interface ClassOption {
  id: string;
  name: string;
  section: string;
}

interface ExamOption {
  id: string;
  name: string;
}

interface AttendanceStats {
  student_id: string;
  student_name: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  attendance_percentage: number;
}

interface ExamPerformance {
  student_id: string;
  student_name: string;
  exam_name: string;
  subject_name: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number;
  grade: string;
}

interface ClassAnalytics {
  class_name: string;
  total_students: number;
  avg_attendance: number;
  avg_marks: number;
}

interface AttendanceRecord {
  student_id: string;
  is_present: boolean;
  students: {
    full_name: string;
  } | null;
}

interface ExamPerformanceRecord {
  student_id: string;
  obtained_marks: number;
  total_marks: number;
  grade: string | null;
  students: {
    full_name: string;
  } | null;
  exams: {
    name: string;
  } | null;
  subjects: {
    name: string;
  } | null;
}

interface GradeDistribution {
  grade: string;
  count: number;
}

interface AttendancePhpRow {
  student_id: string;
  class_id: string;
  is_present: boolean | number | null;
}

interface ExamResultPhpRow {
  student_id: string;
  exam_id: string;
  subject_id: string;
  obtained_marks: number;
  total_marks: number;
  grade: string | null;
}

interface SubjectPhpRow {
  id: string;
  name: string;
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

function calculateGrade(percentage: number) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

export function ReportsAnalytics() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("performance");
  
  // Filters
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedExam, setSelectedExam] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  
  // Data
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats[]>([]);
  const [examPerformance, setExamPerformance] = useState<ExamPerformance[]>([]);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics[]>([]);

  const loadClassAnalytics = useCallback(async (classList: ClassOption[]) => {
    try {
      if (isPhpBackend) {
        const [activeStudents, attendanceData, marksData] = await Promise.all([
          phpListAll<Student>('students', { school_id: profile?.school_id, status: 'active' }),
          phpListAll<AttendancePhpRow>('attendance', { school_id: profile?.school_id }),
          phpListAll<ExamResultPhpRow>('exam_results', { school_id: profile?.school_id }),
        ]);

        const analytics = classList.map(classItem => {
          const classStudents = activeStudents.filter(student => student.class_id === classItem.id);
          const studentIds = new Set(classStudents.map(student => student.id));
          const classAttendance = attendanceData.filter(record => record.class_id === classItem.id);
          const classMarks = marksData.filter(mark => studentIds.has(mark.student_id));
          const avgAttendance = classAttendance.length > 0
            ? Math.round((classAttendance.filter(a => isTruthy(a.is_present)).length / classAttendance.length) * 100)
            : 0;
          const avgMarks = classMarks.length > 0
            ? Math.round(
                classMarks.reduce((sum, mark) => {
                  return sum + (mark.total_marks > 0 ? (mark.obtained_marks / mark.total_marks) * 100 : 0);
                }, 0) / classMarks.length
              )
            : 0;

          return {
            class_name: `${classItem.name} - ${classItem.section}`,
            total_students: classStudents.length,
            avg_attendance: avgAttendance,
            avg_marks: avgMarks,
          };
        });

        setClassAnalytics(analytics);
        return;
      }

      // Get class-wise analytics
      const analytics: ClassAnalytics[] = [];

      for (const classItem of classList) {
        // Get students count
        const { count: studentCount } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classItem.id)
          .eq('status', 'active');

        // Get average attendance
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('is_present')
          .eq('class_id', classItem.id);

        const avgAttendance = attendanceData && attendanceData.length > 0
          ? Math.round((attendanceData.filter(a => a.is_present).length / attendanceData.length) * 100)
          : 0;

        // Get average marks
        const { data: marksData } = await supabase
          .from('exam_results')
          .select('obtained_marks, total_marks')
          .eq('school_id', profile?.school_id);

        const avgMarks = marksData && marksData.length > 0
          ? Math.round(
              marksData.reduce((sum, m) => sum + (m.total_marks > 0 ? (m.obtained_marks / m.total_marks) * 100 : 0), 0) / 
              marksData.length
            )
          : 0;

        analytics.push({
          class_name: `${classItem.name} - ${classItem.section}`,
          total_students: studentCount || 0,
          avg_attendance: avgAttendance,
          avg_marks: avgMarks
        });
      }

      setClassAnalytics(analytics);
    } catch (error) {
      handleSupabaseError('Load class analytics', error, {
        context: { schoolId: profile?.school_id, classCount: classList.length },
      });
    }
  }, [profile?.school_id]);

  const loadAttendanceStats = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const [attendanceRows, studentRows] = await Promise.all([
          phpListAll<AttendancePhpRow>('attendance', {
            school_id: profile?.school_id,
            ...(selectedClass !== "all" ? { class_id: selectedClass } : {}),
          }),
          phpListAll<Student>('students', {
            school_id: profile?.school_id,
            status: 'active',
            ...(selectedClass !== "all" ? { class_id: selectedClass } : {}),
          }, 'full_name', 'asc'),
        ]);
        const studentsById = new Map(studentRows.map(student => [student.id, student]));
        const statsMap = new Map<string, AttendanceStats>();

        attendanceRows.forEach((record) => {
          const studentId = record.student_id;
          const studentName = studentsById.get(studentId)?.full_name || 'Unknown';

          if (!statsMap.has(studentId)) {
            statsMap.set(studentId, {
              student_id: studentId,
              student_name: studentName,
              total_days: 0,
              present_days: 0,
              absent_days: 0,
              attendance_percentage: 0,
            });
          }

          const stats = statsMap.get(studentId)!;
          stats.total_days++;
          if (isTruthy(record.is_present)) {
            stats.present_days++;
          } else {
            stats.absent_days++;
          }
        });

        const statsArray = Array.from(statsMap.values()).map(stat => ({
          ...stat,
          attendance_percentage: stat.total_days > 0
            ? Math.round((stat.present_days / stat.total_days) * 100)
            : 0,
        }));

        setAttendanceStats(statsArray.sort((a, b) =>
          b.attendance_percentage - a.attendance_percentage
        ));
        return;
      }

      let query = supabase
        .from('attendance')
        .select(`
          *,
          students (
            id,
            student_id,
            full_name
          )
        `);

      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      if (selectedClass !== "all") {
        query = query.eq('class_id', selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Process attendance data
      const statsMap = new Map<string, AttendanceStats>();
      
      (data as AttendanceRecord[] | null)?.forEach((record) => {
        const studentId = record.student_id;
        const studentName = record.students?.full_name || 'Unknown';
        
        if (!statsMap.has(studentId)) {
          statsMap.set(studentId, {
            student_id: studentId,
            student_name: studentName,
            total_days: 0,
            present_days: 0,
            absent_days: 0,
            attendance_percentage: 0
          });
        }
        
        const stats = statsMap.get(studentId)!;
        stats.total_days++;
        if (record.is_present) {
          stats.present_days++;
        } else {
          stats.absent_days++;
        }
      });

      // Calculate percentages
      const statsArray = Array.from(statsMap.values()).map(stat => ({
        ...stat,
        attendance_percentage: stat.total_days > 0 
          ? Math.round((stat.present_days / stat.total_days) * 100)
          : 0
      }));

      setAttendanceStats(statsArray.sort((a, b) => 
        b.attendance_percentage - a.attendance_percentage
      ));
    } catch (error) {
      const notice = handleSupabaseError('Load attendance analytics', error, {
        context: { schoolId: profile?.school_id, selectedClass },
      });
      toast.error(notice.title, { description: notice.description });
    }
  }, [profile?.school_id, selectedClass]);

  const loadExamPerformance = useCallback(async () => {
    try {
      if (isPhpBackend) {
        const [results, studentRows, examRows, subjectRows] = await Promise.all([
          phpListAll<ExamResultPhpRow>('exam_results', {
            school_id: profile?.school_id,
            ...(selectedExam !== "all" ? { exam_id: selectedExam } : {}),
            ...(selectedStudent !== "all" ? { student_id: selectedStudent } : {}),
          }),
          phpListAll<Student>('students', { school_id: profile?.school_id, status: 'active' }, 'full_name', 'asc'),
          phpListAll<ExamOption>('exams', { school_id: profile?.school_id, is_active: 1 }, 'exam_date', 'desc'),
          phpListAll<SubjectPhpRow>('subjects', { school_id: profile?.school_id, is_active: 1 }, 'name', 'asc'),
        ]);
        const studentsById = new Map(studentRows.map(student => [student.id, student]));
        const examsById = new Map(examRows.map(exam => [exam.id, exam]));
        const subjectsById = new Map(subjectRows.map(subject => [subject.id, subject]));

        const performance = results
          .map((result) => {
            const percentage = result.total_marks > 0
              ? Math.round((result.obtained_marks / result.total_marks) * 100)
              : 0;

            return {
              student_id: result.student_id,
              student_name: studentsById.get(result.student_id)?.full_name || 'Unknown',
              exam_name: examsById.get(result.exam_id)?.name || 'Unknown',
              subject_name: subjectsById.get(result.subject_id)?.name || 'Unknown',
              obtained_marks: result.obtained_marks,
              total_marks: result.total_marks,
              percentage,
              grade: result.grade || calculateGrade(percentage),
            };
          })
          .sort((a, b) => b.obtained_marks - a.obtained_marks);

        setExamPerformance(performance);
        return;
      }

      let query = supabase
        .from('exam_results')
        .select(`
          *,
          students (
            student_id,
            full_name
          ),
          exams (
            name
          ),
          subjects (
            name
          )
        `);

      if (profile?.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      if (selectedExam !== "all") {
        query = query.eq('exam_id', selectedExam);
      }

      if (selectedStudent !== "all") {
        query = query.eq('student_id', selectedStudent);
      }

      const { data, error } = await query.order('obtained_marks', { ascending: false });
      if (error) throw error;

      const performance = (data as ExamPerformanceRecord[] | null)?.map((result) => ({
        student_id: result.student_id,
        student_name: result.students?.full_name || 'Unknown',
        exam_name: result.exams?.name || 'Unknown',
        subject_name: result.subjects?.name || 'Unknown',
        obtained_marks: result.obtained_marks,
        total_marks: result.total_marks,
        percentage: result.total_marks > 0
          ? Math.round((result.obtained_marks / result.total_marks) * 100)
          : 0,
        grade: result.grade || 'N/A'
      })) || [];

      setExamPerformance(performance);
    } catch (error) {
      const notice = handleSupabaseError('Load exam performance analytics', error, {
        context: { schoolId: profile?.school_id, selectedExam, selectedStudent },
      });
      toast.error(notice.title, { description: notice.description });
    }
  }, [profile?.school_id, selectedExam, selectedStudent]);

  const loadReportData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load attendance statistics
      await loadAttendanceStats();
      
      // Load exam performance
      await loadExamPerformance();
      
    } catch (error) {
      const notice = handleSupabaseError('Load report data', error, {
        context: { schoolId: profile?.school_id, selectedClass, selectedExam, selectedStudent },
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setLoading(false);
    }
  }, [loadAttendanceStats, loadExamPerformance, profile?.school_id, selectedClass, selectedExam, selectedStudent]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);

      if (isPhpBackend) {
        const [classesData, examsData, studentsData] = await Promise.all([
          phpListAll<ClassOption>('classes', {
            school_id: profile?.school_id,
            is_active: 1,
          }, 'name', 'asc'),
          phpListAll<ExamOption>('exams', {
            school_id: profile?.school_id,
            is_active: 1,
          }, 'exam_date', 'desc'),
          phpListAll<Student>('students', {
            school_id: profile?.school_id,
            status: 'active',
          }, 'full_name', 'asc'),
        ]);

        const classesById = new Map(classesData.map(classItem => [classItem.id, classItem]));
        const normalizedStudents = studentsData.map(student => {
          const classItem = classesById.get(student.class_id);
          return {
            ...student,
            classes: classItem ? {
              name: classItem.name,
              section: classItem.section,
              class_level: '',
            } : undefined,
          };
        });

        setClasses(classesData);
        setExams(examsData);
        setStudents(normalizedStudents);
        await loadClassAnalytics(classesData);
        return;
      }
      
      // Load classes
      let classQuery = supabase
        .from('classes')
        .select('*')
        .eq('is_active', true);
      
      if (profile?.school_id) {
        classQuery = classQuery.eq('school_id', profile.school_id);
      }
      
      const { data: classesData, error: classesError } = await classQuery.order('name');
      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load exams
      let examQuery = supabase
        .from('exams')
        .select('*')
        .eq('is_active', true);
      
      if (profile?.school_id) {
        examQuery = examQuery.eq('school_id', profile.school_id);
      }
      
      const { data: examsData, error: examsError } = await examQuery.order('exam_date', { ascending: false });
      if (examsError) throw examsError;
      setExams(examsData || []);

      // Load students
      let studentQuery = supabase
        .from('students')
        .select(`
          *,
          classes (
            name,
            section,
            class_level
          )
        `)
        .eq('status', 'active');
      
      if (profile?.school_id) {
        studentQuery = studentQuery.eq('school_id', profile.school_id);
      }
      
      const { data: studentsData, error: studentsError } = await studentQuery.order('full_name');
      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // Load class analytics
      await loadClassAnalytics(classesData || []);
      
    } catch (error) {
      const notice = handleSupabaseError('Load reports dashboard data', error, {
        context: { schoolId: profile?.school_id },
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setLoading(false);
    }
  }, [loadClassAnalytics, profile?.school_id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedClass !== "all" || selectedExam !== "all") {
      loadReportData();
    }
  }, [selectedClass, selectedExam, selectedStudent, loadReportData]);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return 'bg-green-100 text-green-800 border-green-200';
      case 'A': return 'bg-green-100 text-green-700 border-green-200';
      case 'A-': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'B': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'F': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Chart data preparations
  const gradeDistribution = examPerformance.reduce<GradeDistribution[]>((acc, perf) => {
    const existing = acc.find(item => item.grade === perf.grade);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ grade: perf.grade, count: 1 });
    }
    return acc;
  }, []).sort((a, b) => {
    const gradeOrder = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];
    return gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
  });

  const COLORS = ['#22c55e', '#3b82f6', '#06b6d4', '#eab308', '#f59e0b', '#ef4444', '#dc2626'];

  const exportReport = () => {
    toast.success('Report export feature coming soon!');
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Comprehensive insights on student performance and attendance
          </p>
        </div>
        <Button onClick={exportReport} variant="outline" className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classes.length}</p>
                <p className="text-xs text-muted-foreground">Active Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{exams.length}</p>
                <p className="text-xs text-muted-foreground">Exams Conducted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {attendanceStats.length > 0 
                    ? Math.round(attendanceStats.reduce((sum, s) => sum + s.attendance_percentage, 0) / attendanceStats.length)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-11 touch-target">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} - {cls.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedExam} onValueChange={setSelectedExam}>
              <SelectTrigger className="h-11 touch-target">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Exams</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="h-11 touch-target">
                <SelectValue placeholder="All Students" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Students</SelectItem>
                {students
                  .filter(s => selectedClass === "all" || s.class_id === selectedClass)
                  .map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="performance" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm touch-target-sm">
            <Award className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Performance</span>
            <span className="sm:hidden">Perf</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm touch-target-sm">
            <Target className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Attendance</span>
            <span className="sm:hidden">Attend</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 md:gap-2 py-2 px-2 md:px-4 text-xs md:text-sm touch-target-sm">
            <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Student Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Grade Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Grade Distribution
                </CardTitle>
                <CardDescription>Distribution of grades across selected filters</CardDescription>
              </CardHeader>
              <CardContent>
                {gradeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No exam data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Top Performers
                </CardTitle>
                <CardDescription>Students with highest average scores</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {examPerformance.length > 0 ? (
                    <div className="space-y-3">
                      {examPerformance.slice(0, 10).map((perf, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-primary">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{perf.student_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{perf.subject_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className={getGradeColor(perf.grade)}>
                              {perf.grade}
                            </Badge>
                            <span className="text-sm font-semibold">{perf.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No performance data available</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detailed Performance Report</CardTitle>
              <CardDescription>Complete exam results for selected filters</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Marks</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead>Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examPerformance.length > 0 ? (
                      examPerformance.map((perf, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{perf.student_name}</TableCell>
                          <TableCell>{perf.exam_name}</TableCell>
                          <TableCell>{perf.subject_name}</TableCell>
                          <TableCell className="text-right">
                            {perf.obtained_marks} / {perf.total_marks}
                          </TableCell>
                          <TableCell className="text-right">{perf.percentage}%</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getGradeColor(perf.grade)}>
                              {perf.grade}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No exam results found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Summary Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Attendance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Attendance Overview
                </CardTitle>
                <CardDescription>Student attendance percentages</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {attendanceStats.length > 0 ? (
                    <div className="space-y-3">
                      {attendanceStats.map((stat, idx) => (
                        <div key={idx} className="space-y-2 p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{stat.student_name}</p>
                            <span className={`text-sm font-semibold ${getAttendanceColor(stat.attendance_percentage)}`}>
                              {stat.attendance_percentage}%
                            </span>
                          </div>
                          <Progress value={stat.attendance_percentage} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Present: {stat.present_days}</span>
                            <span>Absent: {stat.absent_days}</span>
                            <span>Total: {stat.total_days}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No attendance data available</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Attendance Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Attendance Statistics</CardTitle>
                <CardDescription>Summary of attendance patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Excellent (≥90%)</span>
                    <Badge variant="outline" className="bg-green-100 text-green-700">
                      {attendanceStats.filter(s => s.attendance_percentage >= 90).length} students
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Good (75-89%)</span>
                    <Badge variant="outline" className="bg-blue-100 text-blue-700">
                      {attendanceStats.filter(s => s.attendance_percentage >= 75 && s.attendance_percentage < 90).length} students
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average (60-74%)</span>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                      {attendanceStats.filter(s => s.attendance_percentage >= 60 && s.attendance_percentage < 75).length} students
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Poor (&lt;60%)</span>
                    <Badge variant="outline" className="bg-red-100 text-red-700">
                      {attendanceStats.filter(s => s.attendance_percentage < 60).length} students
                    </Badge>
                  </div>
                </div>

                {attendanceStats.length > 0 && (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Excellent', value: attendanceStats.filter(s => s.attendance_percentage >= 90).length },
                          { name: 'Good', value: attendanceStats.filter(s => s.attendance_percentage >= 75 && s.attendance_percentage < 90).length },
                          { name: 'Average', value: attendanceStats.filter(s => s.attendance_percentage >= 60 && s.attendance_percentage < 75).length },
                          { name: 'Poor', value: attendanceStats.filter(s => s.attendance_percentage < 60).length },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Class Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Class-wise Analytics
              </CardTitle>
              <CardDescription>Performance comparison across all classes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={classAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="class_name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg_attendance" name="Avg Attendance %" fill="#3b82f6" />
                  <Bar dataKey="avg_marks" name="Avg Marks %" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Class Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead className="text-right">Students</TableHead>
                        <TableHead className="text-right">Attendance</TableHead>
                        <TableHead className="text-right">Avg Marks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classAnalytics.map((analytics, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{analytics.class_name}</TableCell>
                          <TableCell className="text-right">{analytics.total_students}</TableCell>
                          <TableCell className="text-right">
                            <span className={getAttendanceColor(analytics.avg_attendance)}>
                              {analytics.avg_attendance}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{analytics.avg_marks}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {classAnalytics.length > 0 && (
                    <>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-900">
                          Best Performing Class
                        </p>
                        <p className="text-lg font-bold text-green-700">
                          {classAnalytics.reduce((prev, curr) => 
                            curr.avg_marks > prev.avg_marks ? curr : prev
                          ).class_name}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Average: {Math.max(...classAnalytics.map(c => c.avg_marks))}%
                        </p>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">
                          Best Attendance
                        </p>
                        <p className="text-lg font-bold text-blue-700">
                          {classAnalytics.reduce((prev, curr) => 
                            curr.avg_attendance > prev.avg_attendance ? curr : prev
                          ).class_name}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Attendance: {Math.max(...classAnalytics.map(c => c.avg_attendance))}%
                        </p>
                      </div>

                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-medium text-yellow-900">
                          Needs Attention
                        </p>
                        <p className="text-lg font-bold text-yellow-700">
                          {classAnalytics.reduce((prev, curr) => 
                            curr.avg_marks < prev.avg_marks ? curr : prev
                          ).class_name}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Average: {Math.min(...classAnalytics.map(c => c.avg_marks))}%
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
