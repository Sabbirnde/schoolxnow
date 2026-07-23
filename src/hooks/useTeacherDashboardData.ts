import { useCallback } from 'react';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import { queryKeys } from '@/lib/query-client';
import type { Database } from '@/integrations/database/types';

export interface TeacherDashboardProfile {
  user_id: string;
  school_id: string | null;
  approval_status?: string | null;
}

export interface TeacherStats {
  myClasses: number;
  totalStudents: number;
  mySubjects: number;
  pendingTasks: number;
}

export type ClassStatus = 'current' | 'upcoming' | 'completed';

export interface TodayClass {
  time: string;
  subject: string;
  class: string;
  students: number;
  status: ClassStatus;
  room_number: string | null;
  class_id: string | null;
}

export type TeacherInfo = Database['public']['Tables']['teachers']['Row'];

export interface SchoolInfo {
  name?: string | null;
  name_bangla?: string | null;
  school_type?: string | null;
}

interface ClassInfo {
  id: string;
  name: string | null;
  section: string | null;
}

interface SubjectInfo {
  id: string;
  name: string | null;
}

export interface RecentStudent {
  id: string;
  full_name: string | null;
  student_id: string | null;
  classes?: {
    name: string | null;
    section: string | null;
  } | null;
}

export interface UpcomingExam {
  id: string;
  name: string;
  exam_date: string;
}

export interface TeacherDashboardData {
  stats: TeacherStats;
  teacherInfo: TeacherInfo | null;
  schoolInfo: SchoolInfo | null;
  todayClasses: TodayClass[];
  recentStudents: RecentStudent[];
  upcomingDeadlines: UpcomingExam[];
}

type TimetableEntry = Database['public']['Tables']['timetable']['Row'];
type TeacherRow = TeacherInfo & { school_id?: string | null; user_id?: string | null };
type StudentRow = RecentStudent & {
  class_id: string | null;
  school_id?: string | null;
  status?: string | null;
  admission_date?: string | null;
};
type ExamRow = UpcomingExam & {
  school_id?: string | null;
  is_active?: boolean | number | null;
};

type CountResponse = {
  count: number | null;
  error: unknown;
};

export const defaultTeacherStats: TeacherStats = {
  myClasses: 0,
  totalStudents: 0,
  mySubjects: 0,
  pendingTasks: 0,
};

export const defaultTeacherDashboardData: TeacherDashboardData = {
  stats: defaultTeacherStats,
  teacherInfo: null,
  schoolInfo: null,
  todayClasses: [],
  recentStudents: [],
  upcomingDeadlines: [],
};

const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const readCount = (response: CountResponse): number => {
  if (response.error) throw response.error;
  return response.count || 0;
};

const uniqueValues = (values: Array<string | null>): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

export function buildTodaySchedule(
  timetable: TimetableEntry[],
  classesData: ClassInfo[],
  subjectsData: SubjectInfo[],
  now = new Date()
): TodayClass[] {
  const todayName = daysOfWeek[now.getDay()];

  return timetable
    .filter((entry) => entry.day_of_week?.toLowerCase() === todayName)
    .map((entry) => {
      const classInfo = classesData.find((classItem) => classItem.id === entry.class_id);
      const subjectInfo = subjectsData.find((subject) => subject.id === entry.subject_id);
      const [timeStr] = entry.time_slot?.split('-') || [''];

      if (!timeStr) return null;

      const [hours, minutes] = timeStr.trim().split(':');
      if (!hours || !minutes) return null;

      const classTime = new Date(now);
      classTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      let status: ClassStatus = 'upcoming';
      const minutesDiff = (classTime.getTime() - now.getTime()) / (1000 * 60);

      if (minutesDiff < -60) {
        status = 'completed';
      } else if (minutesDiff >= -60 && minutesDiff <= 0) {
        status = 'current';
      }

      return {
        time: entry.time_slot,
        subject: subjectInfo?.name || 'Unknown Subject',
        class: `${classInfo?.name || 'Unknown'} ${classInfo?.section || ''}`.trim(),
        students: 0,
        status,
        room_number: entry.room_number,
        class_id: entry.class_id,
      };
    })
    .filter((classItem): classItem is TodayClass => Boolean(classItem))
    .sort((a, b) => {
      const timeA = a.time.split('-')[0].trim();
      const timeB = b.time.split('-')[0].trim();
      return timeA.localeCompare(timeB);
    });
}

async function fetchByIds<T>(table: 'classes' | 'subjects', ids: string[]): Promise<T[]> {
  if (ids.length === 0) return [];

  const { data, error } = await apiClient
    .from(table)
    .select('*')
    .in('id', ids);

  if (error) throw error;
  return (data || []) as T[];
}

async function fetchPhpByIds<T extends { id: string }>(
  table: 'classes' | 'subjects',
  schoolId: string,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return [];

  const rows = await phpApi.table<T>(table).list({
    school_id: schoolId,
    limit: 200,
  });
  const idSet = new Set(ids);
  return rows.filter((row) => idSet.has(row.id));
}

export async function fetchTeacherDashboardData(
  profile: TeacherDashboardProfile,
  now = new Date()
): Promise<TeacherDashboardData> {
  if (!profile.user_id || !profile.school_id) {
    return defaultTeacherDashboardData;
  }

  if (isPhpBackend) {
    const teacherRows = await phpApi.table<TeacherRow>('teachers').list({
      user_id: profile.user_id,
      limit: 1,
    });
    const teacher = teacherRows[0] || null;
    const school = await phpApi.table<SchoolInfo & { id: string }>('schools').get(profile.school_id);

    if (!teacher) {
      return {
        ...defaultTeacherDashboardData,
        schoolInfo: school,
      };
    }

    const timetable = await phpApi.table<TimetableEntry>('timetable').list({
      teacher_id: teacher.id,
      school_id: profile.school_id,
      limit: 200,
    });
    const uniqueClassIds = uniqueValues(timetable.map((entry) => entry.class_id));
    const uniqueSubjectIds = uniqueValues(timetable.map((entry) => entry.subject_id));

    const [classesData, subjectsData] = await Promise.all([
      fetchPhpByIds<ClassInfo>('classes', profile.school_id, uniqueClassIds),
      fetchPhpByIds<SubjectInfo>('subjects', profile.school_id, uniqueSubjectIds),
    ]);

    let totalStudentsInMyClasses = 0;
    if (uniqueClassIds.length > 0) {
      const counts = await Promise.all(
        uniqueClassIds.map((classId) =>
          phpApi.table('students').count({ class_id: classId, status: 'active' })
        )
      );
      totalStudentsInMyClasses = counts.reduce((sum, item) => sum + item.count, 0);
    }

    const todaySchedule = buildTodaySchedule(timetable, classesData, subjectsData, now);
    for (const classItem of todaySchedule) {
      if (classItem.class_id) {
        const { count } = await phpApi.table('students').count({
          class_id: classItem.class_id,
          status: 'active',
        });
        classItem.students = count;
      }
    }

    let pendingTasks = 0;
    if (todaySchedule.length > 0) {
      const todayDate = now.toISOString().split('T')[0];

      for (const classItem of todaySchedule) {
        if (classItem.class_id && classItem.status === 'completed') {
          const { count } = await phpApi.table('attendance').count({
            class_id: classItem.class_id,
            date: todayDate,
          });
          if (!count) pendingTasks += 1;
        }
      }
    }

    let recentStudents: RecentStudent[] = [];
    if (uniqueClassIds.length > 0) {
      const classIds = new Set(uniqueClassIds);
      const students = await phpApi.table<StudentRow>('students').list({
        school_id: profile.school_id,
        status: 'active',
        sort: 'admission_date',
        order: 'desc',
        limit: 200,
      });

      const classesById = new Map(classesData.map((classItem) => [classItem.id, classItem]));
      recentStudents = students
        .filter((student) => student.class_id && classIds.has(student.class_id))
        .slice(0, 5)
        .map((student) => ({
          id: student.id,
          full_name: student.full_name,
          student_id: student.student_id,
          classes: student.class_id ? classesById.get(student.class_id) || null : null,
        }));
    }

    const upcomingDeadlines = await phpApi.table<ExamRow>('exams').list({
      school_id: profile.school_id,
      is_active: 1,
      exam_date__gte: now.toISOString().split('T')[0],
      sort: 'exam_date',
      order: 'asc',
      limit: 3,
    });

    return {
      stats: {
        myClasses: uniqueClassIds.length,
        totalStudents: totalStudentsInMyClasses,
        mySubjects: uniqueSubjectIds.length,
        pendingTasks,
      },
      teacherInfo: teacher,
      schoolInfo: school,
      todayClasses: todaySchedule,
      recentStudents,
      upcomingDeadlines,
    };
  }

  const { data: teacher, error: teacherError } = await apiClient
    .from('teachers')
    .select('*')
    .eq('user_id', profile.user_id)
    .single();

  if (teacherError && teacherError.code !== 'PGRST116') {
    throw teacherError;
  }

  const { data: school, error: schoolError } = await apiClient
    .from('schools')
    .select('name, name_bangla, school_type')
    .eq('id', profile.school_id)
    .single();

  if (schoolError) throw schoolError;

  if (!teacher) {
    return {
      ...defaultTeacherDashboardData,
      schoolInfo: school,
    };
  }

  const { data: teacherTimetable, error: timetableError } = await apiClient
    .from('timetable')
    .select('*')
    .eq('teacher_id', teacher.id)
    .eq('school_id', profile.school_id);

  if (timetableError) throw timetableError;

  const timetable = teacherTimetable || [];
  const uniqueClassIds = uniqueValues(timetable.map((entry) => entry.class_id));
  const uniqueSubjectIds = uniqueValues(timetable.map((entry) => entry.subject_id));

  const [classesData, subjectsData] = await Promise.all([
    fetchByIds<ClassInfo>('classes', uniqueClassIds),
    fetchByIds<SubjectInfo>('subjects', uniqueSubjectIds),
  ]);

  let totalStudentsInMyClasses = 0;
  if (uniqueClassIds.length > 0) {
    totalStudentsInMyClasses = readCount(
      await apiClient
        .from('students')
        .select('*', { count: 'exact', head: true })
        .in('class_id', uniqueClassIds)
        .eq('status', 'active')
    );
  }

  const todaySchedule = buildTodaySchedule(timetable, classesData, subjectsData, now);

  for (const classItem of todaySchedule) {
    if (classItem.class_id) {
      classItem.students = readCount(
        await apiClient
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classItem.class_id)
          .eq('status', 'active')
      );
    }
  }

  let pendingTasks = 0;
  if (todaySchedule.length > 0) {
    const todayDate = now.toISOString().split('T')[0];

    for (const classItem of todaySchedule) {
      if (classItem.class_id && classItem.status === 'completed') {
        const attendanceCount = readCount(
          await apiClient
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', classItem.class_id)
            .eq('date', todayDate)
        );

        if (!attendanceCount) {
          pendingTasks += 1;
        }
      }
    }
  }

  let recentStudents: RecentStudent[] = [];
  if (uniqueClassIds.length > 0) {
    const { data: students, error: studentsError } = await apiClient
      .from('students')
      .select('id, full_name, student_id, class_id, admission_date, status, classes(name, section)')
      .in('class_id', uniqueClassIds)
      .eq('status', 'active')
      .order('admission_date', { ascending: false })
      .limit(5);

    if (!studentsError && students) {
      recentStudents = students as unknown as RecentStudent[];
    }
  }

  let upcomingDeadlines: UpcomingExam[] = [];
  const { data: upcomingExams, error: examsError } = await apiClient
    .from('exams')
    .select('id, name, exam_date, class_level')
    .eq('school_id', profile.school_id)
    .eq('is_active', true)
    .gte('exam_date', now.toISOString().split('T')[0])
    .order('exam_date', { ascending: true })
    .limit(3);

  if (!examsError && upcomingExams) {
    upcomingDeadlines = upcomingExams;
  }

  return {
    stats: {
      myClasses: uniqueClassIds.length,
      totalStudents: totalStudentsInMyClasses,
      mySubjects: uniqueSubjectIds.length,
      pendingTasks,
    },
    teacherInfo: teacher,
    schoolInfo: school,
    todayClasses: todaySchedule,
    recentStudents,
    upcomingDeadlines,
  };
}

export function useTeacherDashboardData(profile?: TeacherDashboardProfile | null) {
  const canLoad = Boolean(
    profile?.user_id &&
    profile?.school_id &&
    profile?.approval_status !== 'pending'
  );

  const queryFn = useCallback(() => {
    if (!profile || !canLoad) {
      return Promise.resolve(defaultTeacherDashboardData);
    }

    return fetchTeacherDashboardData(profile);
  }, [canLoad, profile]);

  const query = useCachedQuery(
    'realtime',
    [...queryKeys.analytics('teacher-dashboard', {
      userId: profile?.user_id,
      schoolId: profile?.school_id,
    })],
    queryFn,
    {
      enabled: canLoad,
      retry: 2,
    }
  );

  const data = query.data || defaultTeacherDashboardData;

  return {
    ...data,
    loading: canLoad && query.isLoading,
    fetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
