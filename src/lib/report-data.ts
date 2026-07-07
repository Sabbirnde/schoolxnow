/**
 * Report Data Fetching & Formatting Utilities
 * Consolidates all data fetching logic for school admin reports
 */

import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { supabase } from '@/integrations/php-api/compat-client';

// ============================================================================
// Type Definitions
// ============================================================================

type QueryResponse<T> = { data: T[] | null; error?: unknown };
type IdRow = { id: string };
type AttendanceRow = { is_present: boolean | null };
type MarkRow = { obtained_marks: number | null; total_marks: number | null };
type SubjectLookupRow = { id: string; name: string | null };
type ClassTeachingRow = { className: string | null; section: string | null };

type ClassRow = {
  id: string;
  school_id?: string;
  name: string;
  section: string | null;
  class_level?: string;
  is_active?: boolean | number;
};

type StudentRow = {
  id: string;
  school_id?: string;
  class_id: string | null;
  student_id: string;
  full_name: string;
  status?: string;
};

type SubjectRow = {
  id: string;
  school_id?: string;
  name: string;
  class_level?: string;
};

type TeacherRow = {
  id: string;
  school_id?: string;
  full_name: string;
  email: string | null;
};

type AttendanceFullRow = {
  id?: string;
  school_id?: string;
  student_id: string;
  class_id?: string;
  date?: string;
  is_present: boolean | number | null;
};

type ExamRow = {
  id: string;
  school_id?: string;
  name: string;
  exam_status?: string;
  is_active?: boolean | number;
};

type ExamResultRow = {
  id?: string;
  school_id?: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  obtained_marks: number;
  total_marks: number;
  grade?: string | null;
};

type TimetableRow = {
  id?: string;
  school_id?: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
};

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

function isTruthy(value: boolean | number | string | null | undefined): boolean {
  return value === true || value === 1 || value === '1';
}

function markPercentage(mark: Pick<ExamResultRow, 'obtained_marks' | 'total_marks'>): number {
  return mark.total_marks > 0 ? (mark.obtained_marks / mark.total_marks) * 100 : 0;
}

function rowsById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => [row.id, row]));
}

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
    if (isPhpBackend) {
      const [studentsCount, teachersCount, classesCount, subjectsCount, attendance, marks, activeExamsCount] =
        await Promise.all([
          phpApi.table<StudentRow>('students').count({ school_id: schoolId }),
          phpApi.table<TeacherRow>('teachers').count({ school_id: schoolId }),
          phpApi.table<ClassRow>('classes').count({ school_id: schoolId }),
          phpApi.table<SubjectRow>('subjects').count({ school_id: schoolId }),
          phpListAll<AttendanceFullRow>('attendance', { school_id: schoolId }),
          phpListAll<ExamResultRow>('exam_results', { school_id: schoolId }),
          phpApi.table<ExamRow>('exams').count({ school_id: schoolId, exam_status: 'active' }),
        ]);

      const totalStudents = studentsCount.count;
      const totalTeachers = teachersCount.count;
      const totalClasses = classesCount.count;
      const attendancePercentage = attendance.length
        ? (attendance.filter(a => isTruthy(a.is_present)).length / attendance.length) * 100
        : 0;
      const averagePerformance = marks.length
        ? marks.reduce((sum, m) => sum + markPercentage(m), 0) / marks.length
        : 0;

      return {
        totalStudents,
        activeStudents: totalStudents,
        enrollmentTrend: 5,
        averageClassSize: totalClasses > 0 ? totalStudents / totalClasses : 0,
        averageAttendance: Math.round(attendancePercentage),
        averagePerformance: Math.round(averagePerformance),
        atRiskStudents: marks.filter(m => markPercentage(m) < 40).length,
        excellentStudents: marks.filter(m => markPercentage(m) >= 90).length,
        totalTeachers,
        teacherUtilization: totalTeachers > 0 ? Math.round((totalClasses / totalTeachers) * 100) : 0,
        totalClasses,
        totalSubjects: subjectsCount.count,
        activeExams: activeExamsCount.count,
      };
    }

    // Fetch all necessary data in parallel
    const [studentsResp, teachersResp, classesResp, subjectsResp, attendanceResp, marksResp, examsResp] = 
      await Promise.all([
        supabase.from('students').select('id').eq('school_id', schoolId) as unknown as Promise<QueryResponse<IdRow>>,
        supabase.from('teachers').select('id').eq('school_id', schoolId) as unknown as Promise<QueryResponse<IdRow>>,
        supabase.from('classes').select('id').eq('school_id', schoolId) as unknown as Promise<QueryResponse<IdRow>>,
        supabase.from('subjects').select('id').eq('school_id', schoolId) as unknown as Promise<QueryResponse<IdRow>>,
        supabase.from('attendance').select('is_present') as unknown as Promise<QueryResponse<AttendanceRow>>,
        supabase.from('exam_results').select('obtained_marks, total_marks') as unknown as Promise<QueryResponse<MarkRow>>,
        supabase.from('exams').select('id').eq('school_id', schoolId).eq('exam_status', 'active') as unknown as Promise<QueryResponse<IdRow>>,
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
      ? marksResp.data.reduce((sum, m) => sum + ((m.obtained_marks || 0) / (m.total_marks || 1)) * 100, 0) / marksResp.data.length
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
    if (isPhpBackend) {
      const classData = await phpApi.table<ClassRow>('classes').get(classId);
      const students = await phpListAll<StudentRow>('students', {
        class_id: classId,
        sort: 'full_name',
        order: 'asc',
      });

      const activeStudents = students.filter(s => (s.status || 'active') === 'active');
      const studentIds = new Set(activeStudents.map(s => s.id));
      const [attendanceData, marksData, subjects] = await Promise.all([
        phpListAll<AttendanceFullRow>('attendance', { class_id: classId }),
        phpListAll<ExamResultRow>('exam_results', { school_id: classData.school_id }),
        phpListAll<SubjectRow>('subjects', {
          school_id: classData.school_id,
          ...(classData.class_level ? { class_level: classData.class_level } : {}),
          is_active: 1,
          sort: 'name',
          order: 'asc',
        }),
      ]);
      const studentMarks = marksData.filter(m => studentIds.has(m.student_id));

      const attendanceByStudent = new Map<string, number>();
      activeStudents.forEach(s => {
        const studentAttendance = attendanceData.filter(a => a.student_id === s.id);
        const present = studentAttendance.filter(a => isTruthy(a.is_present)).length;
        attendanceByStudent.set(
          s.id,
          studentAttendance.length > 0 ? (present / studentAttendance.length) * 100 : 0
        );
      });

      const averageAttendance = attendanceByStudent.size > 0
        ? Array.from(attendanceByStudent.values()).reduce((a, b) => a + b, 0) / attendanceByStudent.size
        : 0;

      const marksByStudent = new Map<string, number[]>();
      studentMarks.forEach(m => {
        if (!marksByStudent.has(m.student_id)) marksByStudent.set(m.student_id, []);
        marksByStudent.get(m.student_id)?.push(markPercentage(m));
      });

      let topStudent: { name: string; marks: number } | null = null;
      let maxMarks = 0;
      const lowPerformers: Array<{ name: string; marks: number }> = [];

      marksByStudent.forEach((marks, studentId) => {
        const avgMarks = marks.reduce((a, b) => a + b, 0) / marks.length;
        const student = activeStudents.find(s => s.id === studentId);

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

      const averageMarks = marksByStudent.size > 0
        ? Array.from(marksByStudent.values()).reduce((sum, marks) => {
            return sum + marks.reduce((x, y) => x + y, 0) / marks.length;
          }, 0) / marksByStudent.size
        : 0;

      const subjectWisePerformance = subjects.map(subject => {
        const subjectMarks = studentMarks.filter(m => m.subject_id === subject.id);
        const avgMarks = subjectMarks.length > 0
          ? subjectMarks.reduce((sum, m) => sum + markPercentage(m), 0) / subjectMarks.length
          : 0;
        const passPercentage = subjectMarks.length > 0
          ? (subjectMarks.filter(m => markPercentage(m) >= 40).length / subjectMarks.length) * 100
          : 0;

        return {
          subjectName: subject.name,
          averageMarks: Math.round(avgMarks),
          passPercentage: Math.round(passPercentage),
        };
      });

      return {
        classId,
        className: classData.name,
        section: classData.section || '',
        totalStudents: activeStudents.length,
        averageAttendance: Math.round(averageAttendance),
        averageMarks: Math.round(averageMarks),
        topStudent,
        lowPerformers,
        subjectWisePerformance,
      };
    }

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
    const subjectsResp = await supabase.from('subjects')
      .select('id, name')
      .eq('class_id', classId) as unknown as QueryResponse<SubjectLookupRow>;
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
    if (isPhpBackend) {
      const [subject, students] = await Promise.all([
        phpApi.table<SubjectRow>('subjects').get(subjectId),
        phpListAll<StudentRow>('students', { class_id: classId, status: 'active' }),
      ]);
      const studentIds = new Set(students.map(student => student.id));
      const results = (await phpListAll<ExamResultRow>('exam_results', {
        subject_id: subjectId,
        school_id: subject.school_id,
      })).filter(result => studentIds.has(result.student_id));

      if (results.length === 0) {
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

      const percentages = results.map(markPercentage);
      const averageMarks = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      const passPercentage = (percentages.filter(p => p >= 40).length / percentages.length) * 100;
      const failPercentage = (percentages.filter(p => p < 40).length / percentages.length) * 100;

      return {
        subjectId,
        subjectName: subject.name,
        totalStudents: results.length,
        averageMarks: Math.round(averageMarks),
        passPercentage: Math.round(passPercentage),
        failPercentage: Math.round(failPercentage),
        gradeDistribution: {
          A_PLUS: percentages.filter(p => p >= 90).length,
          A: percentages.filter(p => p >= 80 && p < 90).length,
          B: percentages.filter(p => p >= 70 && p < 80).length,
          C: percentages.filter(p => p >= 60 && p < 70).length,
          D: percentages.filter(p => p >= 40 && p < 60).length,
          F: percentages.filter(p => p < 40).length,
        },
      };
    }

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
    if (isPhpBackend) {
      const student = await phpApi.table<StudentRow>('students').get(studentId);
      const [classData, attendance, exams, results, subjects] = await Promise.all([
        student.class_id ? phpApi.table<ClassRow>('classes').get(student.class_id) : Promise.resolve(null),
        phpListAll<AttendanceFullRow>('attendance', { student_id: studentId }),
        phpListAll<ExamRow>('exams', { school_id: student.school_id, is_active: 1 }),
        phpListAll<ExamResultRow>('exam_results', { student_id: studentId }),
        phpListAll<SubjectRow>('subjects', { school_id: student.school_id, is_active: 1 }),
      ]);

      const totalAttendance = attendance.length;
      const presentDays = attendance.filter(a => isTruthy(a.is_present)).length;
      const attendancePercentage = totalAttendance > 0 ? (presentDays / totalAttendance) * 100 : 0;
      const subjectsById = rowsById(subjects);

      const examMarks = exams.map(exam => {
        const examResults = results.filter(result => result.exam_id === exam.id);
        return {
          examName: exam.name,
          subjects: examResults.map(result => {
            const percentage = markPercentage(result);
            return {
              subjectName: subjectsById.get(result.subject_id)?.name || 'Unknown',
              marks: result.obtained_marks,
              total: result.total_marks,
              percentage,
              grade: getGrade(percentage),
            };
          }),
        };
      });

      const allPercentages = examMarks.flatMap(e => e.subjects.map(s => s.percentage));
      const overallPercentage = allPercentages.length > 0
        ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length
        : 0;

      return {
        studentId,
        studentName: student.full_name,
        rollNumber: student.student_id,
        className: classData?.name || 'Unknown',
        section: classData?.section || 'Unknown',
        totalAttendance,
        attendancePercentage: Math.round(attendancePercentage),
        examMarks,
        overallGrade: getGrade(overallPercentage),
        performanceStatus: getPerformanceStatus(overallPercentage),
      };
    }

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
        let subjects: SubjectLookupRow[] = [];
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

    if (isPhpBackend) {
      const attendanceData = await phpListAll<AttendanceFullRow>('attendance', {
        school_id: schoolId,
        date__gte: startDate.toISOString().split('T')[0],
        ...(classId ? { class_id: classId } : {}),
      }, 'date', 'asc');

      if (attendanceData.length === 0) {
        return [];
      }

      const groupedByDate = new Map<string, { present: number; absent: number; leave: number }>();

      attendanceData.forEach(record => {
        const date = (record.date || '').split('T')[0];
        if (!date) return;
        if (!groupedByDate.has(date)) {
          groupedByDate.set(date, { present: 0, absent: 0, leave: 0 });
        }

        const current = groupedByDate.get(date)!;
        if (isTruthy(record.is_present)) {
          current.present++;
        } else {
          current.absent++;
        }
      });

      return Array.from(groupedByDate.entries())
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
    }

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
    if (isPhpBackend) {
      const [teachers, assignments, students, marks, attendance] = await Promise.all([
        phpListAll<TeacherRow>('teachers', { school_id: schoolId }),
        phpListAll<TimetableRow>('timetable', { school_id: schoolId }),
        phpListAll<StudentRow>('students', { school_id: schoolId, status: 'active' }),
        phpListAll<ExamResultRow>('exam_results', { school_id: schoolId }),
        phpListAll<AttendanceFullRow>('attendance', { school_id: schoolId }),
      ]);

      return teachers.map(teacher => {
        const teacherAssignments = assignments.filter(assignment => assignment.teacher_id === teacher.id);
        const uniqueClasses = new Set(teacherAssignments.map(assignment => assignment.class_id));
        const uniqueSubjects = new Set(teacherAssignments.map(assignment => assignment.subject_id));
        const teacherStudents = students.filter(student => student.class_id && uniqueClasses.has(student.class_id));
        const studentIds = new Set(teacherStudents.map(student => student.id));
        const teacherMarks = marks.filter(mark => studentIds.has(mark.student_id));
        const teacherAttendance = attendance.filter(record => studentIds.has(record.student_id));

        const percentages = teacherMarks.map(markPercentage);
        const averagePerformance = percentages.length > 0
          ? percentages.reduce((a, b) => a + b, 0) / percentages.length
          : 0;
        const averageAttendance = teacherAttendance.length > 0
          ? (teacherAttendance.filter(a => isTruthy(a.is_present)).length / teacherAttendance.length) * 100
          : 0;

        let performanceImpact: 'excellent' | 'good' | 'average' | 'poor' = 'average';
        if (averagePerformance >= 80) performanceImpact = 'excellent';
        else if (averagePerformance >= 60) performanceImpact = 'good';
        else if (averagePerformance < 40) performanceImpact = 'poor';

        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name,
          email: teacher.email || '',
          assignedClasses: uniqueClasses.size,
          assignedSubjects: uniqueSubjects.size,
          studentsTaught: studentIds.size,
          averageStudentPerformance: Math.round(averagePerformance),
          averageStudentAttendance: Math.round(averageAttendance),
          classesWithLowPerformers: percentages.filter(p => p < 40).length,
          classesWithHighPerformers: percentages.filter(p => p >= 80).length,
          performanceImpact,
        };
      });
    }

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
    if (isPhpBackend) {
      const [teacher, classData] = await Promise.all([
        phpApi.table<TeacherRow>('teachers').get(teacherId),
        phpApi.table<ClassRow>('classes').get(classId),
      ]);
      const [assignments, subjects, students, results, attendance] = await Promise.all([
        phpListAll<TimetableRow>('timetable', { teacher_id: teacherId, class_id: classId }),
        phpListAll<SubjectRow>('subjects', { school_id: classData.school_id, is_active: 1 }),
        phpListAll<StudentRow>('students', { class_id: classId, status: 'active' }),
        phpListAll<ExamResultRow>('exam_results', { school_id: classData.school_id }),
        phpListAll<AttendanceFullRow>('attendance', { class_id: classId }),
      ]);

      const subjectMap = rowsById(subjects);
      const subjectIds = new Set(assignments.map(assignment => assignment.subject_id));
      const subjectsTaught = [...subjectIds].map(subjectId => subjectMap.get(subjectId)?.name || 'Unknown');
      const studentIds = new Set(students.map(student => student.id));
      const classResults = results.filter(result => studentIds.has(result.student_id));
      const percentages = classResults.map(markPercentage);
      const averagePerformance = percentages.length > 0
        ? percentages.reduce((a, b) => a + b, 0) / percentages.length
        : 0;
      const averageAttendance = attendance.length > 0
        ? (attendance.filter(a => isTruthy(a.is_present)).length / attendance.length) * 100
        : 0;

      const studentMarks = new Map<string, number[]>();
      classResults.forEach(result => {
        if (!studentMarks.has(result.student_id)) studentMarks.set(result.student_id, []);
        studentMarks.get(result.student_id)?.push(markPercentage(result));
      });

      const sorted = Array.from(studentMarks.entries())
        .map(([id, marks]) => ({
          id,
          name: students.find(student => student.id === id)?.full_name || 'Unknown',
          marks: Math.round(marks.reduce((a, b) => a + b, 0) / marks.length),
        }))
        .sort((a, b) => b.marks - a.marks);

      const subjectWisePerformance = [...subjectIds].map(subjectId => {
        const subjectResults = classResults.filter(result => result.subject_id === subjectId);
        const subjectMarks = subjectResults.map(markPercentage);
        const avgMarks = subjectMarks.length > 0
          ? subjectMarks.reduce((a, b) => a + b, 0) / subjectMarks.length
          : 0;
        const passPercentage = subjectMarks.length > 0
          ? (subjectMarks.filter(mark => mark >= 40).length / subjectMarks.length) * 100
          : 0;

        return {
          subjectName: subjectMap.get(subjectId)?.name || 'Unknown',
          averageMarks: Math.round(avgMarks),
          studentCount: subjectMarks.length,
          passPercentage: Math.round(passPercentage),
        };
      });

      return {
        teacherId,
        teacherName: teacher.full_name || 'Unknown',
        classId,
        className: classData.name || 'Unknown',
        section: classData.section || 'Unknown',
        subjectsTaught,
        totalStudents: students.length,
        averagePerformance: Math.round(averagePerformance),
        averageAttendance: Math.round(averageAttendance),
        topStudents: sorted.slice(0, 3).map(s => ({ name: s.name, marks: s.marks })),
        lowPerformers: sorted.filter(s => s.marks < 40).map(s => ({ name: s.name, marks: s.marks })),
        subjectWisePerformance,
      };
    }

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
    const subjectMap = new Map<string, string>();
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
    if (isPhpBackend) {
      const [teacher, subject, assignments, classes, students, allResults] = await Promise.all([
        phpApi.table<TeacherRow>('teachers').get(teacherId),
        phpApi.table<SubjectRow>('subjects').get(subjectId),
        phpListAll<TimetableRow>('timetable', { school_id: schoolId, teacher_id: teacherId, subject_id: subjectId }),
        phpListAll<ClassRow>('classes', { school_id: schoolId, is_active: 1 }),
        phpListAll<StudentRow>('students', { school_id: schoolId, status: 'active' }),
        phpListAll<ExamResultRow>('exam_results', { school_id: schoolId, subject_id: subjectId }),
      ]);

      const classIds = new Set(assignments.map(assignment => assignment.class_id));
      const classesTeaching = classes
        .filter(classItem => classIds.has(classItem.id))
        .map(classItem => ({
          className: classItem.name,
          section: classItem.section,
        }));
      const teacherStudentIds = new Set(
        students
          .filter(student => student.class_id && classIds.has(student.class_id))
          .map(student => student.id)
      );
      const teacherResults = allResults.filter(result => teacherStudentIds.has(result.student_id));
      const teacherPercentages = teacherResults.map(markPercentage);
      const allPercentages = allResults.map(markPercentage);
      const teacherAverage = teacherPercentages.length > 0
        ? teacherPercentages.reduce((a, b) => a + b, 0) / teacherPercentages.length
        : 0;
      const schoolAverage = allPercentages.length > 0
        ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length
        : 0;

      return {
        teacherId,
        teacherName: teacher.full_name || 'Unknown',
        subjectId,
        subjectName: subject.name || 'Unknown',
        classesTeaching,
        totalStudents: teacherStudentIds.size,
        averageMarks: Math.round(teacherAverage),
        gradeDistribution: {
          A_PLUS: teacherPercentages.filter(p => p >= 90).length,
          A: teacherPercentages.filter(p => p >= 80 && p < 90).length,
          B: teacherPercentages.filter(p => p >= 70 && p < 80).length,
          C: teacherPercentages.filter(p => p >= 60 && p < 70).length,
          D: teacherPercentages.filter(p => p >= 40 && p < 60).length,
          F: teacherPercentages.filter(p => p < 40).length,
        },
        compareToSchoolAverage: {
          teacherAverage: Math.round(teacherAverage),
          schoolAverage: Math.round(schoolAverage),
          difference: Math.round(teacherAverage - schoolAverage),
          isAbove: teacherAverage > schoolAverage,
        },
      };
    }

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
    let classesTeaching: ClassTeachingRow[] = [];
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
