export interface AttendanceStudent {
  id: string;
  school_id?: string;
  student_id: string;
  full_name: string;
  class_id: string;
  classes?: {
    id: string;
    name: string;
    section: string;
  };
}

export interface AttendanceClass {
  id: string;
  school_id?: string;
  name: string;
  section: string;
  class_level: string;
}

export interface AttendanceRecord {
  id?: string;
  school_id?: string;
  student_id: string;
  class_id: string;
  date: string;
  is_present: boolean;
  remarks?: string | null;
  student?: AttendanceStudent;
}

export interface AttendanceTeacher {
  id: string;
  user_id: string | null;
  school_id: string;
}

export interface AttendanceTimetable {
  id: string;
  school_id: string;
  teacher_id: string | null;
  class_id: string;
}

export interface AttendanceSummary {
  total: number;
  marked: number;
  present: number;
  absent: number;
  percentage: string;
  completionPercentage: number;
}
