/**
 * Report Data Fetching & Formatting Utilities
 * Consolidates all data fetching logic for school admin reports
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DashboardMetrics {
  // Enrollment Metrics
  totalStudents: number;
  activeStudents: number;
  enrollmentTrend: number; // percentage change
  averageClassSize: number;

  // Academic Metrics
  averageAttendance: number;
  averagePerformance: number;
  atRiskStudents: number;
  excellentStudents: number;

  // Staff Metrics
  totalTeachers: number;
  teacherUtilization: number;
  
  // Operations
  totalClasses: number;
  totalSubjects: number;
  activeExams: number;
}

export interface ClassReport {
  classId: string;
  className: string;
  section: string;
  totalStudents: number;
  averageAttendance: number;
  averageMarks: number;
  topStudent: {
    name: string;
    marks: number;
  } | null;
  lowPerformers: Array<{
    name: string;
    marks: number;
  }>;
  subjectWisePerformance: Array<{
    subjectName: string;
    averageMarks: number;
    passPercentage: number;
  }>;
}

export interface SubjectReport {
  subjectId: string;
  subjectName: string;
  totalStudents: number;
  averageMarks: number;
  passPercentage: number;
  failPercentage: number;
  gradeDistribution: {
    A_PLUS: number;
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
}

export interface StudentDetailedReport {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  totalAttendance: number;
  attendancePercentage: number;
  examMarks: Array<{
    examName: string;
    subjects: Array<{
      subjectName: string;
      marks: number;
      total: number;
      percentage: number;
      grade: string;
    }>;
  }>;
  overallGrade: string;
  performanceStatus: 'excellent' | 'good' | 'average' | 'poor';
}

export interface AttendanceTrend {
  date: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  attendancePercentage: number;
}

export interface FinancialReport {
  totalStudents: number;
  totalFees: number;
  collectedFees: number;
  pendingFees: number;
  defaulterCount: number;
  collectionPercentage: number;
  classWiseCollection: Array<{
    className: string;
    totalFees: number;
    collectedFees: number;
  }>;
}

export interface TeacherMetrics {
  teacherId: string;
  teacherName: string;
  email: string;
  assignedClasses: number;
  assignedSubjects: number;
  studentsTaught: number;
  averageStudentPerformance: number;
  averageStudentAttendance: number;
  classesWithLowPerformers: number;
  classesWithHighPerformers: number;
  performanceImpact: 'excellent' | 'good' | 'average' | 'poor';
}

export interface TeacherClassReport {
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  section: string;
  subjectsTaught: Array<string>;
  totalStudents: number;
  averagePerformance: number;
  averageAttendance: number;
  topStudents: Array<{
    name: string;
    marks: number;
  }>;
  lowPerformers: Array<{
    name: string;
    marks: number;
  }>;
  subjectWisePerformance: Array<{
    subjectName: string;
    averageMarks: number;
    studentCount: number;
    passPercentage: number;
  }>;
}

export interface TeacherSubjectReport {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  classesTeaching: Array<{
    className: string;
    section: string;
  }>;
  totalStudents: number;
  averageMarks: number;
  gradeDistribution: {
    A_PLUS: number;
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  compareToSchoolAverage: {
    teacherAverage: number;
    schoolAverage: number;
    difference: number;
    isAbove: boolean;
  };
}

// ============================================================================
// Dashboard Metrics
// ============================================================================

export async function fetchDashboardMetrics(schoolId: string): Promise<DashboardMetrics> {
  try {
    // Fetch all necessary data in parallel
    const [studentsResp, teachersResp, classesResp, subjectsResp, attendanceResp, marksResp, examsResp] = 
      await Promise.all([
        supabase.from('students').select('id').eq('school_id', schoolId) as any,
        supabase.from('teachers').select('id').eq('school_id', schoolId) as any,
        (supabase.from('classes') as any).select('id').eq('school_id', schoolId),
        (supabase.from('subjects') as any).select('id').eq('school_id', schoolId),
        (supabase.from('attendance') as any).select('is_present'),
        (supabase.from('exam_results') as any).select('obtained_marks, total_marks'),
        (supabase.from('exams') as any).select('id').eq('school_id', schoolId).eq('exam_status', 'active'),
      ]);

    const totalStudents = studentsResp.data?.length || 0;
    const activeStudents = totalStudents;
    const totalTeachers = teachersResp.data?.length || 0;
    const totalClasses = classesResp.data?.length || 0;
    const totalSubjects = subjectsResp.data?.length || 0;
    const activeExams = examsResp.data?.length || 0;

    // Calculate averages
    const attendancePercentage = attendanceResp.data
      ? (attendanceResp.data.filter(a => a.is_present).length / attendanceResp.data.length) * 100
      : 0;

    const averagePerformance = marksResp.data
      ? marksResp.data.reduce((sum, m) => sum + (m.obtained_marks / m.total_marks) * 100, 0) / marksResp.data.length
      : 0;

    // Calculate at-risk and excellent students
    const atRiskStudents = marksResp.data
      ? marksResp.data.filter(m => (m.obtained_marks / m.total_marks) * 100 < 40).length
      : 0;

    const excellentStudents = marksResp.data
      ? marksResp.data.filter(m => (m.obtained_marks / m.total_marks) * 100 >= 90).length
      : 0;

    // Calculate average class size
    const averageClassSize = totalClasses > 0 ? totalStudents / totalClasses : 0;

    // Calculate teacher utilization (assigned classes / total teachers)
    const teacherUtilization = totalTeachers > 0 ? (totalClasses / totalTeachers) * 100 : 0;

    // Calculate enrollment trend (would need historical data - placeholder for now)
    const enrollmentTrend = 5; // Placeholder

    return {
      totalStudents,
      activeStudents,
      enrollmentTrend,
      averageClassSize,
      averageAttendance: Math.round(attendancePercentage),
      averagePerformance: Math.round(averagePerformance),
      atRiskStudents,
      excellentStudents,
      totalTeachers,
      teacherUtilization: Math.round(teacherUtilization),
      totalClasses,
      totalSubjects,
      activeExams,
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    throw error;
  }
}

// ============================================================================
// Academic Reports
// ============================================================================

export async function fetchClassReport(classId: string): Promise<ClassReport> {
  try {
    // Fetch class details
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();

    if (classError) throw classError;

    // Fetch students in class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, full_name, status')
      .eq('class_id', classId);

    if (studentsError) throw studentsError;

    const activeStudents = students?.filter(s => s.status === 'active') || [];
    const studentIds = activeStudents.map(s => s.id);

    // Fetch attendance data
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('student_id, is_present')
      .in('student_id', studentIds.length > 0 ? studentIds : ['']);

    // Fetch marks data
    const { data: marksData } = await supabase
      .from('exam_results')
      .select('student_id, obtained_marks, total_marks, subject_id')
      .in('student_id', studentIds.length > 0 ? studentIds : ['']);

    // Fetch subjects
    const subjectsResp = await (supabase.from('subjects') as any)
      .select('id, name')
      .eq('class_id', classId);
    const { data: subjects } = subjectsResp;

    // Calculate metrics
    const attendanceByStudent = new Map<string, number>();
    activeStudents.forEach(s => {
      if (attendanceData) {
        const present = attendanceData.filter(a => a.student_id === s.id && a.is_present).length;
        const total = attendanceData.filter(a => a.student_id === s.id).length;
        attendanceByStudent.set(s.id, total > 0 ? (present / total) * 100 : 0);
      }
    });

    const averageAttendance = Array.from(attendanceByStudent.values()).length > 0
      ? Array.from(attendanceByStudent.values()).reduce((a, b) => a + b, 0) / attendanceByStudent.size
      : 0;

    // Calculate marks by student
    const marksByStudent = new Map<string, number[]>();
    marksData?.forEach(m => {
      if (!marksByStudent.has(m.student_id)) {
        marksByStudent.set(m.student_id, []);
      }
      marksByStudent.get(m.student_id)?.push((m.obtained_marks / m.total_marks) * 100);
    });

    let topStudent: { name: string; marks: number } | null = null;
    let maxMarks = 0;
    const lowPerformers: Array<{ name: string; marks: number }> = [];

    marksByStudent.forEach((marks, studentId) => {
      const avgMarks = marks.reduce((a, b) => a + b, 0) / marks.length;
      const student = students?.find(s => s.id === studentId);

      if (avgMarks > maxMarks) {
        maxMarks = avgMarks;
        topStudent = { name: student?.full_name || 'Unknown', marks: Math.round(avgMarks) };
      }

      if (avgMarks < 40) {
        lowPerformers.push({
          name: student?.full_name || 'Unknown',
          marks: Math.round(avgMarks),
        });
      }
    });

    const averageMarks = Array.from(marksByStudent.values()).length > 0
      ? Array.from(marksByStudent.values()).reduce((a, b) => a + (b.reduce((x, y) => x + y, 0) / b.length), 0) / marksByStudent.size
      : 0;

    // Calculate subject-wise performance
    const subjectWisePerformance = (subjects || []).map(subject => {
      const subjectMarks = marksData?.filter(m => m.subject_id === subject.id) || [];
      const avgMarks = subjectMarks.length > 0
        ? subjectMarks.reduce((sum, m) => sum + (m.obtained_marks / m.total_marks) * 100, 0) / subjectMarks.length
        : 0;

      const passCount = subjectMarks.filter(m => (m.obtained_marks / m.total_marks) * 100 >= 40).length;
      const passPercentage = subjectMarks.length > 0 ? (passCount / subjectMarks.length) * 100 : 0;

      return {
        subjectName: subject.name,
        averageMarks: Math.round(avgMarks),
        passPercentage: Math.round(passPercentage),
      };
    });

    return {
      classId,
      className: classData.name,
      section: classData.section,
      totalStudents: activeStudents.length,
      averageAttendance: Math.round(averageAttendance),
      averageMarks: Math.round(averageMarks),
      topStudent,
      lowPerformers,
      subjectWisePerformance,
    };
  } catch (error) {
    console.error('Error fetching class report:', error);
    throw error;
  }
}

// ============================================================================
// Subject Reports
// ============================================================================

export async function fetchSubjectReport(subjectId: string, classId: string): Promise<SubjectReport> {
  try {
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .single();

    if (subjectError) throw subjectError;

    // Fetch exam results for this subject
    const { data: results } = await supabase
      .from('exam_results')
      .select('obtained_marks, total_marks')
      .eq('subject_id', subjectId);

    if (!results || results.length === 0) {
      return {
        subjectId,
        subjectName: subject.name,
        totalStudents: 0,
        averageMarks: 0,
        passPercentage: 0,
        failPercentage: 0,
        gradeDistribution: { A_PLUS: 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
      };
    }

    const percentages = results.map(r => (r.obtained_marks / r.total_marks) * 100);
    const averageMarks = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const passPercentage = (percentages.filter(p => p >= 40).length / percentages.length) * 100;
    const failPercentage = (percentages.filter(p => p < 40).length / percentages.length) * 100;

    // Grade distribution
    const gradeDistribution = {
      A_PLUS: percentages.filter(p => p >= 90).length,
      A: percentages.filter(p => p >= 80 && p < 90).length,
      B: percentages.filter(p => p >= 70 && p < 80).length,
      C: percentages.filter(p => p >= 60 && p < 70).length,
      D: percentages.filter(p => p >= 40 && p < 60).length,
      F: percentages.filter(p => p < 40).length,
    };

    return {
      subjectId,
      subjectName: subject.name,
      totalStudents: results.length,
      averageMarks: Math.round(averageMarks),
      passPercentage: Math.round(passPercentage),
      failPercentage: Math.round(failPercentage),
      gradeDistribution,
    };
  } catch (error) {
    console.error('Error fetching subject report:', error);
    throw error;
  }
}

// ============================================================================
// Student Detailed Report
// ============================================================================

export async function fetchStudentDetailedReport(studentId: string): Promise<StudentDetailedReport> {
  try {
    // Fetch student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, classes(name, section)')
      .eq('id', studentId)
      .single();

    if (studentError) throw studentError;

    // Fetch attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('is_present')
      .eq('student_id', studentId);

    const totalAttendance = attendance?.length || 0;
    const presentDays = attendance?.filter(a => a.is_present).length || 0;
    const attendancePercentage = totalAttendance > 0 ? (presentDays / totalAttendance) * 100 : 0;

    // Fetch exam marks
    const { data: exams } = await supabase
      .from('exams')
      .select('id, name');

    const examMarks = await Promise.all(
      (exams || []).map(async exam => {
        const { data: results } = await supabase
          .from('exam_results')
          .select('subject_id, obtained_marks, total_marks')
          .eq('exam_id', exam.id)
          .eq('student_id', studentId);

        // Fetch subject names for the results
        const subjectIds = [...new Set(results?.map(r => r.subject_id) || [])];
        let subjects: any[] = [];
        if (subjectIds.length > 0) {
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds);
          subjects = subjectData || [];
        }

        return {
          examName: exam.name,
          subjects: (results || []).map(r => {
            const subject = subjects.find(s => s.id === r.subject_id);
            return {
              subjectName: subject?.name || 'Unknown',
              marks: r.obtained_marks,
              total: r.total_marks,
              percentage: (r.obtained_marks / r.total_marks) * 100,
              grade: getGrade((r.obtained_marks / r.total_marks) * 100),
            };
          }),
        };
      })
    );

    // Calculate overall metrics
    const allPercentages = examMarks.flatMap(e => e.subjects.map(s => s.percentage));
    const overallPercentage = allPercentages.length > 0 ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length : 0;
    const overallGrade = getGrade(overallPercentage);
    const performanceStatus = getPerformanceStatus(overallPercentage);

    return {
      studentId,
      studentName: student.full_name,
      rollNumber: student.student_id,
      className: student.classes?.name || 'Unknown',
      section: student.classes?.section || 'Unknown',
      totalAttendance,
      attendancePercentage: Math.round(attendancePercentage),
      examMarks,
      overallGrade,
      performanceStatus,
    };
  } catch (error) {
    console.error('Error fetching student report:', error);
    throw error;
  }
}

// ============================================================================
// Attendance Trends
// ============================================================================

export async function fetchAttendanceTrend(
  schoolId: string,
  classId?: string,
  days: number = 30
): Promise<AttendanceTrend[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('attendance')
      .select('date, is_present')
      .gte('date', startDate.toISOString());

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data: attendanceData } = await query;

    if (!attendanceData || attendanceData.length === 0) {
      return [];
    }

    // Group by date
    const groupedByDate = new Map<string, { present: number; absent: number; leave: number }>();

    attendanceData.forEach(record => {
      const date = record.date.split('T')[0];
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, { present: 0, absent: 0, leave: 0 });
      }

      const current = groupedByDate.get(date)!;
      if (record.is_present) {
        current.present++;
      } else {
        current.absent++;
      }
    });

    // Convert to array and sort by date
    const trend = Array.from(groupedByDate.entries())
      .map(([date, counts]) => {
        const total = counts.present + counts.absent + counts.leave;
        return {
          date,
          presentCount: counts.present,
          absentCount: counts.absent,
          leaveCount: counts.leave,
          attendancePercentage: total > 0 ? (counts.present / total) * 100 : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return trend;
  } catch (error) {
    console.error('Error fetching attendance trend:', error);
    throw error;
  }
}

// ============================================================================
// Teacher Performance Reports
// ============================================================================

export async function fetchTeacherMetrics(schoolId: string): Promise<TeacherMetrics[]> {
  try {
    // Fetch all teachers in school
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, full_name, email')
      .eq('school_id', schoolId);

    if (teachersError) throw teachersError;
    if (!teachers || teachers.length === 0) return [];

    // Fetch teacher assignments
    const teacherMetrics = await Promise.all(
      teachers.map(async teacher => {
        // Get assigned classes
        const { data: classAssignments } = await supabase
          .from('timetable')
          .select('class_id, subject_id, classes(id, name)')
          .eq('teacher_id', teacher.id);

        const uniqueClasses = new Set(classAssignments?.map(a => a.class_id) || []);
        const uniqueSubjects = new Set(classAssignments?.map(a => a.subject_id) || []);

        // Get all students in teacher's classes
        const { data: classIds } = await supabase
          .from('classes')
          .select('id')
          .eq('school_id', schoolId);

        const { data: students } = await supabase
          .from('students')
          .select('id')
          .in('class_id', classIds?.map(c => c.id) || [])
          .eq('status', 'active');

        const studentIds = students?.map(s => s.id) || [];

        // Get marks for teacher's students
        const { data: marks } = await supabase
          .from('exam_results')
          .select('obtained_marks, total_marks')
          .in('student_id', studentIds.length > 0 ? studentIds : ['']);

        // Get attendance
        const { data: attendance } = await supabase
          .from('attendance')
          .select('is_present')
          .in('student_id', studentIds.length > 0 ? studentIds : ['']);

        const percentages = marks?.map(m => (m.obtained_marks / m.total_marks) * 100) || [];
        const averagePerformance = percentages.length > 0
          ? percentages.reduce((a, b) => a + b, 0) / percentages.length
          : 0;

        const averageAttendance = attendance?.length
          ? (attendance.filter(a => a.is_present).length / attendance.length) * 100
          : 0;

        // Count students with low/high performance
        const lowPerformerCount = percentages.filter(p => p < 40).length;
        const highPerformerCount = percentages.filter(p => p >= 80).length;

        // Determine performance impact
        let performanceImpact: 'excellent' | 'good' | 'average' | 'poor' = 'average';
        if (averagePerformance >= 80) performanceImpact = 'excellent';
        else if (averagePerformance >= 60) performanceImpact = 'good';
        else if (averagePerformance < 40) performanceImpact = 'poor';

        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name,
          email: teacher.email,
          assignedClasses: uniqueClasses.size,
          assignedSubjects: uniqueSubjects.size,
          studentsTaught: studentIds.length,
          averageStudentPerformance: Math.round(averagePerformance),
          averageStudentAttendance: Math.round(averageAttendance),
          classesWithLowPerformers: lowPerformerCount,
          classesWithHighPerformers: highPerformerCount,
          performanceImpact,
        };
      })
    );

    return teacherMetrics;
  } catch (error) {
    console.error('Error fetching teacher metrics:', error);
    throw error;
  }
}

export async function fetchTeacherClassReport(teacherId: string, classId: string): Promise<TeacherClassReport> {
  try {
    // Get teacher info
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('id', teacherId)
      .single();

    // Get class info
    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, section')
      .eq('id', classId)
      .single();

    // Get subjects taught by this teacher in this class
    const { data: assignments } = await supabase
      .from('timetable')
      .select('subject_id')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId);

    // Fetch subject details
    const subjectIds = [...new Set(assignments?.map(a => a.subject_id) || [])];
    let subjectMap = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
      subjects?.forEach(s => subjectMap.set(s.id, s.name));
    }

    const subjectsTaught = assignments?.map(a => subjectMap.get(a.subject_id) || 'Unknown') || [];

    // Get students in class
    const { data: students } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('class_id', classId)
      .eq('status', 'active');

    const studentIds = students?.map(s => s.id) || [];

    // Get exam results for this class
    const { data: results } = await supabase
      .from('exam_results')
      .select('student_id, obtained_marks, total_marks, subject_id')
      .in('student_id', studentIds.length > 0 ? studentIds : ['']);

    // Calculate performance metrics
    const percentages = results?.map(r => (r.obtained_marks / r.total_marks) * 100) || [];
    const averagePerformance = percentages.length > 0
      ? percentages.reduce((a, b) => a + b, 0) / percentages.length
      : 0;

    // Get attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('is_present')
      .in('student_id', studentIds.length > 0 ? studentIds : ['']);

    const averageAttendance = attendance?.length
      ? (attendance.filter(a => a.is_present).length / attendance.length) * 100
      : 0;

    // Top and low performers
    const studentMarks = new Map<string, number>();
    results?.forEach(r => {
      if (!studentMarks.has(r.student_id)) {
        const marks = ((r.obtained_marks / r.total_marks) * 100);
        studentMarks.set(r.student_id, marks);
      }
    });

    const sorted = Array.from(studentMarks.entries())
      .map(([id, marks]) => ({
        id,
        name: students?.find(s => s.id === id)?.full_name || 'Unknown',
        marks: Math.round(marks),
      }))
      .sort((a, b) => b.marks - a.marks);

    const topStudents = sorted.slice(0, 3);
    const lowPerformers = sorted.filter(s => s.marks < 40);

    // Subject-wise performance
    const subjectWisePerformance = (assignments || []).map(assignment => {
      const subjectResults = results?.filter(r => r.subject_id === assignment.subject_id) || [];
      const subjectMarks = subjectResults.map(r => (r.obtained_marks / r.total_marks) * 100);
      const avgMarks = subjectMarks.length > 0 ? subjectMarks.reduce((a, b) => a + b, 0) / subjectMarks.length : 0;
      const passCount = subjectMarks.filter(m => m >= 40).length;
      const passPercentage = subjectMarks.length > 0 ? (passCount / subjectMarks.length) * 100 : 0;

      return {
        subjectName: subjectMap.get(assignment.subject_id) || 'Unknown',
        averageMarks: Math.round(avgMarks),
        studentCount: subjectMarks.length,
        passPercentage: Math.round(passPercentage),
      };
    });

    return {
      teacherId,
      teacherName: teacher?.full_name || 'Unknown',
      classId,
      className: classData?.name || 'Unknown',
      section: classData?.section || 'Unknown',
      subjectsTaught,
      totalStudents: studentIds.length,
      averagePerformance: Math.round(averagePerformance),
      averageAttendance: Math.round(averageAttendance),
      topStudents: topStudents.map(s => ({ name: s.name, marks: s.marks })),
      lowPerformers: lowPerformers.map(s => ({ name: s.name, marks: s.marks })),
      subjectWisePerformance,
    };
  } catch (error) {
    console.error('Error fetching teacher class report:', error);
    throw error;
  }
}

export async function fetchTeacherSubjectReport(teacherId: string, subjectId: string, schoolId: string): Promise<TeacherSubjectReport> {
  try {
    // Get teacher info
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('id', teacherId)
      .single();

    // Get subject info
    const { data: subject } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('id', subjectId)
      .single();

    // Get classes where teacher teaches this subject
    const { data: assignments } = await supabase
      .from('timetable')
      .select('class_id')
      .eq('teacher_id', teacherId)
      .eq('subject_id', subjectId);

    // Fetch class details
    const classIds = [...new Set(assignments?.map(a => a.class_id) || [])];
    let classesTeaching: any[] = [];
    if (classIds.length > 0) {
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name, section')
        .in('id', classIds);
      classesTeaching = classesData?.map(c => ({
        className: c.name,
        section: c.section,
      })) || [];
    }

    // Get all exam results for this subject
    const { data: allResults } = await supabase
      .from('exam_results')
      .select('obtained_marks, total_marks')
      .eq('subject_id', subjectId);

    const { data: teacherResults } = await supabase
      .from('exam_results')
      .select('obtained_marks, total_marks')
      .eq('subject_id', subjectId);

    // Calculate metrics
    const teacherPercentages = teacherResults?.map(r => (r.obtained_marks / r.total_marks) * 100) || [];
    const allPercentages = allResults?.map(r => (r.obtained_marks / r.total_marks) * 100) || [];

    const teacherAverage = teacherPercentages.length > 0
      ? teacherPercentages.reduce((a, b) => a + b, 0) / teacherPercentages.length
      : 0;

    const schoolAverage = allPercentages.length > 0
      ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length
      : 0;

    // Grade distribution
    const gradeDistribution = {
      A_PLUS: teacherPercentages.filter(p => p >= 90).length,
      A: teacherPercentages.filter(p => p >= 80 && p < 90).length,
      B: teacherPercentages.filter(p => p >= 70 && p < 80).length,
      C: teacherPercentages.filter(p => p >= 60 && p < 70).length,
      D: teacherPercentages.filter(p => p >= 40 && p < 60).length,
      F: teacherPercentages.filter(p => p < 40).length,
    };

    return {
      teacherId,
      teacherName: teacher?.full_name || 'Unknown',
      subjectId,
      subjectName: subject?.name || 'Unknown',
      classesTeaching,
      totalStudents: teacherPercentages.length,
      averageMarks: Math.round(teacherAverage),
      gradeDistribution,
      compareToSchoolAverage: {
        teacherAverage: Math.round(teacherAverage),
        schoolAverage: Math.round(schoolAverage),
        difference: Math.round(teacherAverage - schoolAverage),
        isAbove: teacherAverage > schoolAverage,
      },
    };
  } catch (error) {
    console.error('Error fetching teacher subject report:', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

function getPerformanceStatus(percentage: number): 'excellent' | 'good' | 'average' | 'poor' {
  if (percentage >= 80) return 'excellent';
  if (percentage >= 60) return 'good';
  if (percentage >= 40) return 'average';
  return 'poor';
}
