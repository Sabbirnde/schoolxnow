/**
 * Teacher Performance Reports Component
 * Comprehensive teacher effectiveness analytics and class/subject performance attribution
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTeacherMetricsExport, useTeacherClassReportExport } from '@/hooks/useReportExport';
import {
  fetchTeacherMetrics,
  fetchTeacherClassReport,
  fetchTeacherSubjectReport,
  TeacherMetrics,
  TeacherClassReport,
  TeacherSubjectReport,
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
  TrendingUp,
  Award,
  Users,
  Target,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function TeacherPerformanceReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const metricsExport = useTeacherMetricsExport();
  const classReportExport = useTeacherClassReportExport();

  // State management
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherMetrics[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [teacherDetails, setTeacherDetails] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherMetrics | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classReport, setClassReport] = useState<TeacherClassReport | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [subjectReport, setSubjectReport] = useState<TeacherSubjectReport | null>(null);

  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [activeTab, setActiveTab] = useState('overview');

  // Load teacher metrics on mount
  useEffect(() => {
    if (profile?.school_id) {
      loadTeacherMetrics();
    }
  }, [profile?.school_id]);

  // Load class report when class and teacher are selected
  useEffect(() => {
    if (selectedTeacherId && selectedClassId && activeTab === 'classes') {
      loadClassReport(selectedTeacherId, selectedClassId);
    }
  }, [selectedTeacherId, selectedClassId, activeTab]);

  // Load subject report when subject and teacher are selected
  useEffect(() => {
    if (selectedTeacherId && selectedSubjectId && activeTab === 'subjects') {
      loadSubjectReport(selectedTeacherId, selectedSubjectId);
    }
  }, [selectedTeacherId, selectedSubjectId, activeTab]);

  const loadTeacherMetrics = useCallback(async () => {
    if (!profile?.school_id) return;

    try {
      const metrics = await fetchTeacherMetrics(profile.school_id);
      setTeachers(metrics);
      
      if (metrics.length > 0) {
        setSelectedTeacherId(metrics[0].teacherId);
        setSelectedTeacher(metrics[0]);

        // Load teacher details (classes and subjects)
        const { data: assignments } = await supabase
          .from('timetable')
          .select('class_id, subject_id')
          .eq('teacher_id', metrics[0].teacherId);

        if (assignments && assignments.length > 0) {
          // Get unique class IDs
          const classIds = Array.from(new Set(assignments.map(a => a.class_id)));
          const subjectIds = Array.from(new Set(assignments.map(a => a.subject_id)));
          
          // Fetch class details
          const { data: classesData } = await supabase
            .from('classes')
            .select('id, name, section')
            .in('id', classIds);
            
          // Fetch subject details
          const { data: subjectsData } = await supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds);

          setClasses(classesData || []);
          setSubjects(subjectsData || []);

          if (classesData && classesData.length > 0) {
            setSelectedClassId(classesData[0].id);
          }
          if (subjectsData && subjectsData.length > 0) {
            setSelectedSubjectId(subjectsData[0].id);
          }
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading teacher metrics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load teacher metrics',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [profile?.school_id, toast]);

  const handleTeacherChange = useCallback(async (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const teacher = teachers.find(t => t.teacherId === teacherId);
    setSelectedTeacher(teacher || null);

    // Load this teacher's classes and subjects
    try {
      const { data: assignments } = await supabase
        .from('timetable')
        .select('class_id, subject_id')
        .eq('teacher_id', teacherId);

      if (assignments && assignments.length > 0) {
        // Get unique class and subject IDs
        const classIds = Array.from(new Set(assignments.map(a => a.class_id)));
        const subjectIds = Array.from(new Set(assignments.map(a => a.subject_id)));
        
        // Fetch class details
        const { data: classesData } = await supabase
          .from('classes')
          .select('id, name, section')
          .in('id', classIds);
          
        // Fetch subject details
        const { data: subjectsData } = await supabase
          .from('subjects')
          .select('id, name')
          .in('id', subjectIds);

        setClasses(classesData || []);
        setSubjects(subjectsData || []);

        if (classesData && classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
        }
        if (subjectsData && subjectsData.length > 0) {
          setSelectedSubjectId(subjectsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading teacher details:', error);
    }
  }, [teachers]);

  const loadClassReport = useCallback(async (teacherId: string, classId: string) => {
    try {
      const report = await fetchTeacherClassReport(teacherId, classId);
      setClassReport(report);
    } catch (error) {
      console.error('Error loading class report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load class report',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadSubjectReport = useCallback(async (teacherId: string, subjectId: string) => {
    if (!profile?.school_id) return;

    try {
      const report = await fetchTeacherSubjectReport(teacherId, subjectId, profile.school_id);
      setSubjectReport(report);
    } catch (error) {
      console.error('Error loading subject report:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subject report',
        variant: 'destructive',
      });
    }
  }, [profile?.school_id, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading teacher performance data...</p>
        </div>
      </div>
    );
  }

  const getPerformanceColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 text-green-800';
      case 'good':
        return 'bg-blue-100 text-blue-800';
      case 'average':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceTextColor = (status: string) => {
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
          <h1 className="text-3xl font-bold text-foreground">👨‍🏫 Teacher Performance Analytics</h1>
          <p className="text-muted-foreground mt-1">Teaching effectiveness, class attribution, and subject expertise</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 gap-4 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Teacher Overview</span>
            <span className="sm:hidden">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Class Impact</span>
            <span className="sm:hidden">Classes</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Subject Analysis</span>
            <span className="sm:hidden">Subjects</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Teacher Selection & Export
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 flex-wrap items-end">
              <Select value={selectedTeacherId} onValueChange={handleTeacherChange}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.teacherId} value={teacher.teacherId}>
                      {teacher.teacherName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => metricsExport.exportMetrics(teachers, exportFormat)}
                disabled={metricsExport.isExporting}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {metricsExport.isExporting ? 'Exporting...' : 'Export All'}
              </Button>
            </CardContent>
          </Card>

          {selectedTeacher && (
            <>
              {/* Teacher Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>{selectedTeacher.teacherName}</CardTitle>
                  <CardDescription>{selectedTeacher.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{selectedTeacher.assignedClasses}</p>
                      <p className="text-sm text-muted-foreground">Classes Assigned</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{selectedTeacher.assignedSubjects}</p>
                      <p className="text-sm text-muted-foreground">Subjects Teaching</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{selectedTeacher.studentsTaught}</p>
                      <p className="text-sm text-muted-foreground">Students Impact</p>
                    </div>
                    <div className={`p-4 rounded-lg ${getPerformanceColor(selectedTeacher.performanceImpact)}`}>
                      <p className="font-semibold capitalize">{selectedTeacher.performanceImpact}</p>
                      <p className="text-xs">Performance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Student outcomes attributed to this teacher</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium">Average Student Performance</label>
                      <span className="text-sm font-semibold">{selectedTeacher.averageStudentPerformance}%</span>
                    </div>
                    <Progress value={selectedTeacher.averageStudentPerformance} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium">Average Student Attendance</label>
                      <span className="text-sm font-semibold">{selectedTeacher.averageStudentAttendance}%</span>
                    </div>
                    <Progress value={selectedTeacher.averageStudentAttendance} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-muted-foreground">High Achievers (80%+)</p>
                      <p className="text-2xl font-bold text-green-700">{selectedTeacher.classesWithHighPerformers}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-muted-foreground">Need Support (&lt;40%)</p>
                      <p className="text-2xl font-bold text-red-700">{selectedTeacher.classesWithLowPerformers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Teacher Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Teachers Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher Name</TableHead>
                      <TableHead className="text-right">Classes</TableHead>
                      <TableHead className="text-right">Subjects</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Avg Performance</TableHead>
                      <TableHead>Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map(teacher => (
                      <TableRow key={teacher.teacherId}>
                        <TableCell className="font-medium">{teacher.teacherName}</TableCell>
                        <TableCell className="text-right">{teacher.assignedClasses}</TableCell>
                        <TableCell className="text-right">{teacher.assignedSubjects}</TableCell>
                        <TableCell className="text-right">{teacher.studentsTaught}</TableCell>
                        <TableCell className="text-right">{teacher.averageStudentPerformance}%</TableCell>
                        <TableCell>
                          <Badge className={getPerformanceColor(teacher.performanceImpact)}>
                            {teacher.performanceImpact}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Class Impact Tab */}
        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class & Subject Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedTeacherId} onValueChange={handleTeacherChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.teacherId} value={teacher.teacherId}>
                      {teacher.teacherName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
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
            </CardContent>
          </Card>

          {classReport && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {classReport.className} - Section {classReport.section}
                  </CardTitle>
                  <CardDescription>Impact of {classReport.teacherName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{classReport.totalStudents}</p>
                      <p className="text-sm text-muted-foreground">Total Students</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{classReport.averagePerformance}%</p>
                      <p className="text-sm text-muted-foreground">Avg Performance</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{classReport.averageAttendance}%</p>
                      <p className="text-sm text-muted-foreground">Avg Attendance</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-lg font-bold text-foreground">{classReport.subjectsTaught.length}</p>
                      <p className="text-sm text-muted-foreground">Subjects Taught</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {classReport.topStudents.length > 0 && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <TrendingUp className="h-5 w-5" />
                      Top Performing Students
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {classReport.topStudents.map((student, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-white rounded">
                          <span className="font-medium text-green-900">{student.name}</span>
                          <span className="text-sm font-semibold text-green-700">{student.marks}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {classReport.lowPerformers.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      Students Needing Support
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {classReport.lowPerformers.map((student, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-white rounded">
                          <span className="font-medium text-red-900">{student.name}</span>
                          <span className="text-sm font-semibold text-red-700">{student.marks}%</span>
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
                        <p className="text-xs text-muted-foreground">{subject.studentCount} students taught</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Subject Analysis Tab */}
        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subject Expert Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedTeacherId} onValueChange={handleTeacherChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map(teacher => (
                    <SelectItem key={teacher.teacherId} value={teacher.teacherId}>
                      {teacher.teacherName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                  <CardDescription>Expertise: {subjectReport.teacherName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{subjectReport.totalStudents}</p>
                      <p className="text-sm text-muted-foreground">Students</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">{subjectReport.averageMarks}%</p>
                      <p className="text-sm text-muted-foreground">Average Marks</p>
                    </div>
                    <div className={`p-4 rounded-lg ${subjectReport.compareToSchoolAverage.isAbove ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-sm font-semibold ${subjectReport.compareToSchoolAverage.isAbove ? 'text-green-700' : 'text-red-700'}`}>
                        {subjectReport.compareToSchoolAverage.isAbove ? '+' : ''}{subjectReport.compareToSchoolAverage.difference}%
                      </p>
                      <p className="text-xs text-muted-foreground">vs School Avg</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
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

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">School Comparison</p>
                    <div className="space-y-1 text-sm">
                      <p>Teacher Average: <span className="font-semibold">{subjectReport.compareToSchoolAverage.teacherAverage}%</span></p>
                      <p>School Average: <span className="font-semibold">{subjectReport.compareToSchoolAverage.schoolAverage}%</span></p>
                      <p className={`font-semibold ${subjectReport.compareToSchoolAverage.isAbove ? 'text-green-600' : 'text-red-600'}`}>
                        {subjectReport.compareToSchoolAverage.isAbove ? 'Above' : 'Below'} School Average by {Math.abs(subjectReport.compareToSchoolAverage.difference)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {subjectReport.classesTeaching.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Classes Teaching This Subject</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {subjectReport.classesTeaching.map((cls, idx) => (
                        <div key={idx} className="p-3 bg-muted rounded-lg border">
                          <p className="font-medium text-sm">{cls.className}</p>
                          <p className="text-xs text-muted-foreground">Section {cls.section}</p>
                        </div>
                      ))}
                    </div>
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

export default TeacherPerformanceReports;
