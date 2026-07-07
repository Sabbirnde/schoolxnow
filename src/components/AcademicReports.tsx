/**
 * Academic Reports Component
 * Detailed class-wise, subject-wise, and student-wise academic reporting
 */

import { useState, useEffect, useCallback } from 'react';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { supabase } from '@/integrations/php-api/compat-client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClassReportExport, useStudentReportExport } from '@/hooks/useReportExport';
import {
  fetchClassReport,
  fetchSubjectReport,
  fetchStudentDetailedReport,
  ClassReport,
  SubjectReport,
  StudentDetailedReport,
} from '@/lib/report-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Download,
  AlertCircle,
  Trophy,
  TrendingDown,
  Users,
  BookOpen,
  Target,
  Loader2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { handleSupabaseError } from '@/lib/api-error-handler';

interface ClassOption {
  id: string;
  name: string;
  section: string | null;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  full_name: string;
  student_id: string;
  classes: {
    name: string;
    section: string;
  } | null;
}

interface QueryResponse<T> {
  data: T[] | null;
  error: unknown;
}

interface ClassPhpRow extends ClassOption {
  school_id: string;
  class_level: string;
  is_active: boolean | number;
}

interface StudentPhpRow {
  id: string;
  full_name: string;
  student_id: string;
  class_id: string | null;
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

export function AcademicReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const classExport = useClassReportExport();
  const studentExport = useStudentReportExport();

  // State management
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classReport, setClassReport] = useState<ClassReport | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [subjectReport, setSubjectReport] = useState<SubjectReport | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentReport, setStudentReport] = useState<StudentDetailedReport | null>(null);

  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('pdf');
  const [activeTab, setActiveTab] = useState('class');

  const loadClasses = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      if (isPhpBackend) {
        const data = await phpListAll<ClassPhpRow>('classes', {
          school_id: profile.school_id,
          is_active: 1,
        }, 'name', 'asc');

        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].id);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('classes')
        .select('id, name, section')
        .eq('school_id', profile.school_id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
      setLoading(false);
    } catch (error) {
      const notice = handleSupabaseError('Load academic report classes', error, {
        context: { schoolId: profile?.school_id },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [profile?.school_id, toast]);

  const loadClassReport = useCallback(async (classId: string) => {
    try {
      const report = await fetchClassReport(classId);
      setClassReport(report);

      if (isPhpBackend) {
        const classData = await phpApi.table<ClassPhpRow>('classes').get(classId);
        const data = await phpListAll<SubjectOption>('subjects', {
          school_id: classData.school_id,
          class_level: classData.class_level,
          is_active: 1,
        }, 'name', 'asc');

        setSubjects(data);
        if (data.length > 0) {
          setSelectedSubjectId(data[0].id);
        }
        return;
      }

      // Also load subjects for this class
      const { data, error } = await supabase.from('subjects')
        .select('id, name')
        .eq('class_id', classId) as unknown as QueryResponse<SubjectOption>;

      if (error) throw error;
      setSubjects(data || []);
      if (data && data.length > 0) {
        setSelectedSubjectId(data[0].id);
      }
    } catch (error) {
      const notice = handleSupabaseError('Load class academic report', error, {
        context: { classId },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadSubjectReport = useCallback(async (subjectId: string) => {
    try {
      const report = await fetchSubjectReport(subjectId, selectedClassId);
      setSubjectReport(report);
    } catch (error) {
      const notice = handleSupabaseError('Load subject academic report', error, {
        context: { subjectId, classId: selectedClassId },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: 'destructive',
      });
    }
  }, [selectedClassId, toast]);

  const loadStudents = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      if (isPhpBackend) {
        const [studentRows, classRows] = await Promise.all([
          phpListAll<StudentPhpRow>('students', {
            school_id: profile.school_id,
            status: 'active',
          }, 'full_name', 'asc'),
          phpListAll<ClassPhpRow>('classes', {
            school_id: profile.school_id,
            is_active: 1,
          }, 'name', 'asc'),
        ]);
        const classesById = new Map(classRows.map(classItem => [classItem.id, classItem]));
        const data: StudentOption[] = studentRows.map(student => {
          const classItem = student.class_id ? classesById.get(student.class_id) : null;
          return {
            id: student.id,
            full_name: student.full_name,
            student_id: student.student_id,
            classes: classItem ? {
              name: classItem.name,
              section: classItem.section || '',
            } : null,
          };
        });

        setStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(data[0].id);
        }
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, student_id, classes(name, section)')
        .eq('school_id', profile.school_id)
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;

      setStudents(data || []);
      if (data && data.length > 0) {
        setSelectedStudentId(data[0].id);
      }
    } catch (error) {
      const notice = handleSupabaseError('Load academic report students', error, {
        context: { schoolId: profile?.school_id },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: 'destructive',
      });
    }
  }, [profile?.school_id, toast]);

  const loadStudentReport = useCallback(async (studentId: string) => {
    try {
      const report = await fetchStudentDetailedReport(studentId);
      setStudentReport(report);
    } catch (error) {
      const notice = handleSupabaseError('Load student academic report', error, {
        context: { studentId },
      });
      toast({
        title: notice.title,
        description: notice.description,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === 'student' && students.length === 0) {
      loadStudents();
    }
  }, [students.length, loadStudents]);

  // Load classes and reports after callbacks are initialized so hook dependencies stay explicit.
  useEffect(() => {
    if (profile?.school_id) {
      loadClasses();
    }
  }, [profile?.school_id, loadClasses]);

  useEffect(() => {
    if (selectedClassId && activeTab === 'class') {
      loadClassReport(selectedClassId);
    }
  }, [selectedClassId, activeTab, loadClassReport]);

  useEffect(() => {
    if (selectedSubjectId && activeTab === 'subject') {
      loadSubjectReport(selectedSubjectId);
    }
  }, [selectedSubjectId, activeTab, loadSubjectReport]);

  useEffect(() => {
    if (selectedStudentId && activeTab === 'student') {
      loadStudentReport(selectedStudentId);
    }
  }, [selectedStudentId, activeTab, loadStudentReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading academic reports...</p>
        </div>
      </div>
    );
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      case 'D':
        return 'bg-orange-100 text-orange-800';
      case 'F':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600';
      case 'good':
        return 'text-blue-600';
      case 'average':
        return 'text-yellow-600';
      case 'poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">📚 Academic Reports</h1>
          <p className="text-muted-foreground mt-1">Class, subject, and student performance analysis</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 gap-4 mb-6">
          <TabsTrigger value="class" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Class Reports</span>
            <span className="sm:hidden">Classes</span>
          </TabsTrigger>
          <TabsTrigger value="subject" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Subject Analytics</span>
            <span className="sm:hidden">Subjects</span>
          </TabsTrigger>
          <TabsTrigger value="student" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Student Details</span>
            <span className="sm:hidden">Students</span>
          </TabsTrigger>
        </TabsList>

        {/* Class Reports Tab */}
        <TabsContent value="class" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Class Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} - Section {cls.section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classReport && (
                <Button
                  onClick={() => classExport.exportClassReport(classReport, exportFormat)}
                  disabled={classExport.isExporting}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {classExport.isExporting ? 'Exporting...' : 'Export'}
                </Button>
              )}
            </CardContent>
          </Card>

          {classReport && (
            <>
              {/* Class Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {classReport.className} - Section {classReport.section}
                  </CardTitle>
                  <CardDescription>Performance overview and key metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{classReport.totalStudents}</p>
                      <p className="text-sm text-muted-foreground">Total Students</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {classReport.averageAttendance}%
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Attendance</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {classReport.averageMarks}%
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Performance</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {classReport.lowPerformers.length}
                      </p>
                      <p className="text-sm text-muted-foreground">Low Performers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performer */}
              {classReport.topStudent && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Trophy className="h-5 w-5" />
                      Top Performer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-green-900">{classReport.topStudent.name}</p>
                    <p className="text-sm text-green-700 mt-1">
                      Score: {classReport.topStudent.marks}%
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Low Performers */}
              {classReport.lowPerformers.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      Low Performers (Below 40%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {classReport.lowPerformers.map((performer, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded">
                          <span className="font-medium text-red-900">{performer.name}</span>
                          <span className="text-sm text-red-700">{performer.marks}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Subject-wise Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Subject-wise Performance</CardTitle>
                  <CardDescription>Average marks and pass percentage by subject</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {classReport.subjectWisePerformance.map((subject, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-sm">{subject.subjectName}</h4>
                          <span className="text-sm font-semibold">
                            {subject.averageMarks}% ({subject.passPercentage}% pass)
                          </span>
                        </div>
                        <Progress value={subject.averageMarks} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Subject Analytics Tab */}
        <TabsContent value="subject" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subj => (
                    <SelectItem key={subj.id} value={subj.id}>
                      {subj.subject_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {subjectReport && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{subjectReport.subjectName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {subjectReport.totalStudents}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Students</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {subjectReport.averageMarks}%
                      </p>
                      <p className="text-sm text-muted-foreground">Average Marks</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {subjectReport.passPercentage}%
                      </p>
                      <p className="text-sm text-muted-foreground">Pass Rate</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {subjectReport.failPercentage}%
                      </p>
                      <p className="text-sm text-muted-foreground">Fail Rate</p>
                    </div>
                  </div>

                  <h4 className="font-semibold mb-3">Grade Distribution</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { grade: 'A+', count: subjectReport.gradeDistribution.A_PLUS, color: 'bg-green-100' },
                      { grade: 'A', count: subjectReport.gradeDistribution.A, color: 'bg-green-100' },
                      { grade: 'B', count: subjectReport.gradeDistribution.B, color: 'bg-blue-100' },
                      { grade: 'C', count: subjectReport.gradeDistribution.C, color: 'bg-yellow-100' },
                      { grade: 'D', count: subjectReport.gradeDistribution.D, color: 'bg-orange-100' },
                      { grade: 'F', count: subjectReport.gradeDistribution.F, color: 'bg-red-100' },
                    ].map(item => (
                      <div key={item.grade} className={`p-3 rounded-lg text-center ${item.color}`}>
                        <p className="font-bold text-lg">{item.count}</p>
                        <p className="text-xs font-medium">{item.grade}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Student Details Tab */}
        <TabsContent value="student" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Selection</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name} ({student.student_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {studentReport && (
                <Button
                  onClick={() => studentExport.exportStudentReport(studentReport, exportFormat)}
                  disabled={studentExport.isExporting}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {studentExport.isExporting ? 'Exporting...' : 'Export'}
                </Button>
              )}
            </CardContent>
          </Card>

          {studentReport && (
            <>
              {/* Student Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{studentReport.studentName}</CardTitle>
                  <CardDescription>
                    {studentReport.className} - Section {studentReport.section}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {studentReport.attendancePercentage}%
                      </p>
                      <p className="text-sm text-muted-foreground">Attendance</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {studentReport.overallGrade}
                      </p>
                      <p className="text-sm text-muted-foreground">Overall Grade</p>
                    </div>
                    <div className={`p-4 rounded-lg ${getPerformanceColor(studentReport.performanceStatus)}`}>
                      <p className="font-semibold text-white capitalize">
                        {studentReport.performanceStatus}
                      </p>
                      <p className="text-sm text-gray-100">Performance</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Attendance Days</p>
                      <p className="text-2xl font-bold text-foreground">
                        {studentReport.totalAttendance}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Exam Marks */}
              {studentReport.examMarks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Exam-wise Marks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {studentReport.examMarks.map((exam, examIdx) => (
                      <div key={examIdx} className="space-y-3">
                        <h4 className="font-semibold text-md border-b pb-2">{exam.examName}</h4>
                        <div className="overflow-x-auto">
                          <Table className="text-sm">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead className="text-right">Marks</TableHead>
                                <TableHead className="text-right">%</TableHead>
                                <TableHead>Grade</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {exam.subjects.map((subject, subIdx) => (
                                <TableRow key={subIdx}>
                                  <TableCell className="font-medium">{subject.subjectName}</TableCell>
                                  <TableCell className="text-right">
                                    {subject.marks}/{subject.total}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {subject.percentage.toFixed(1)}%
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getGradeColor(subject.grade)}>
                                      {subject.grade}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AcademicReports;
