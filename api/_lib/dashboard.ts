import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { requireUser } from "./auth.js";
import { query, transaction } from "./db.js";
import { ApiError, sendData } from "./http.js";

type SchoolRow = RowDataPacket & {
  id: string;
  name: string;
  name_bangla: string | null;
  school_type: string;
};

type StatsRow = RowDataPacket & {
  totalStudents: number | string;
  activeStudents: number | string;
  totalTeachers: number | string;
  totalClasses: number | string;
  totalSubjects: number | string;
  recentAdmissions: number | string;
};

type TasksRow = RowDataPacket & {
  pendingAttendance: number | string;
  scheduledExams: number | string;
  newAdmissions: number | string;
  pendingApplications: number | string;
};

type AdmissionRow = RowDataPacket & {
  id: string;
  full_name: string;
  admission_date: string;
  class_id: string | null;
  class_name: string | null;
};

type ActivityRow = RowDataPacket & {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  timestamp: string;
  success: number | boolean;
  error_message: string | null;
  user_id: string | null;
  metadata: unknown;
};

const numberValue = (value: number | string) => Number(value || 0);

async function dashboardSnapshot(connection: PoolConnection, schoolId: string) {
  const schools = await query<SchoolRow[]>(
    `SELECT id, name, name_bangla, school_type
     FROM schools
     WHERE id = :school_id AND is_active = 1
     LIMIT 1`,
    { school_id: schoolId },
    connection,
  );
  const school = schools[0];
  if (!school) {
    throw new ApiError(404, "School not found");
  }

  const statsRows = await query<StatsRow[]>(
    `SELECT
       (SELECT COUNT(*) FROM students WHERE school_id = :school_id) AS totalStudents,
       (SELECT COUNT(*) FROM students WHERE school_id = :school_id AND status = 'active') AS activeStudents,
       (SELECT COUNT(*) FROM teachers WHERE school_id = :school_id AND is_active = 1) AS totalTeachers,
       (SELECT COUNT(*) FROM classes WHERE school_id = :school_id AND is_active = 1) AS totalClasses,
       (SELECT COUNT(*) FROM subjects WHERE school_id = :school_id AND is_active = 1) AS totalSubjects,
       (SELECT COUNT(*) FROM students
        WHERE school_id = :school_id AND admission_date >= UTC_DATE() - INTERVAL 30 DAY) AS recentAdmissions`,
    { school_id: schoolId },
    connection,
  );

  const taskRows = await query<TasksRow[]>(
    `SELECT
       (SELECT COUNT(*)
        FROM classes c
        WHERE c.school_id = :school_id
          AND c.is_active = 1
          AND NOT EXISTS (
            SELECT 1 FROM attendance a
            WHERE a.school_id = c.school_id
              AND a.class_id = c.id
              AND a.date = UTC_DATE()
          )) AS pendingAttendance,
       (SELECT COUNT(*) FROM exams
        WHERE school_id = :school_id
          AND is_active = 1
          AND exam_date BETWEEN UTC_DATE() AND UTC_DATE() + INTERVAL 7 DAY) AS scheduledExams,
       (SELECT COUNT(*) FROM students
        WHERE school_id = :school_id
          AND status = 'active'
          AND admission_date = UTC_DATE()) AS newAdmissions,
       (SELECT COUNT(*) FROM teacher_applications
        WHERE school_id = :school_id AND status = 'pending') AS pendingApplications`,
    { school_id: schoolId },
    connection,
  );

  const admissions = await query<AdmissionRow[]>(
    `SELECT s.id, s.full_name, s.admission_date, s.class_id, c.name AS class_name
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_id AND c.school_id = s.school_id
     WHERE s.school_id = :school_id
     ORDER BY s.admission_date DESC, s.created_at DESC
     LIMIT 5`,
    { school_id: schoolId },
    connection,
  );

  const activity = await query<ActivityRow[]>(
    `SELECT id, action, entity_type, entity_id, timestamp, success,
            error_message, user_id, metadata
     FROM audit_logs
     WHERE school_id = :school_id
       AND entity_type IN (
         'students', 'teachers', 'classes', 'exams',
         'attendance', 'exam_marks', 'timetable', 'subjects'
       )
     ORDER BY timestamp DESC
     LIMIT 15`,
    { school_id: schoolId },
    connection,
  );

  const stats = statsRows[0];
  const tasks = taskRows[0];

  return {
    school,
    stats: {
      totalStudents: numberValue(stats.totalStudents),
      activeStudents: numberValue(stats.activeStudents),
      totalTeachers: numberValue(stats.totalTeachers),
      totalClasses: numberValue(stats.totalClasses),
      totalSubjects: numberValue(stats.totalSubjects),
      recentAdmissions: numberValue(stats.recentAdmissions),
    },
    recentAdmissions: admissions.map((student) => ({
      id: student.id,
      full_name: student.full_name,
      admission_date: student.admission_date,
      class_id: student.class_id,
      classes: student.class_name ? { name: student.class_name } : null,
    })),
    tasks: {
      pendingAttendance: numberValue(tasks.pendingAttendance),
      scheduledExams: numberValue(tasks.scheduledExams),
      newAdmissions: numberValue(tasks.newAdmissions),
      pendingApplications: numberValue(tasks.pendingApplications),
    },
    recentActivity: activity.map((entry) => ({
      ...entry,
      success: Number(entry.success) === 1,
    })),
  };
}

export async function handleDashboard(
  req: VercelRequest,
  res: VercelResponse,
  segments: string[],
) {
  if (req.method !== "GET" || segments[1] !== "school-admin" || segments.length !== 2) {
    throw new ApiError(404, "Dashboard route not found");
  }

  const user = await requireUser(req);
  const rawSchoolId = req.query.school_id;
  const schoolId = String(Array.isArray(rawSchoolId) ? rawSchoolId[0] : rawSchoolId || "").trim();

  if (!schoolId) {
    throw new ApiError(422, "school_id is required");
  }
  if (user.role !== "school_admin" || !user.school_id || user.school_id !== schoolId) {
    throw new ApiError(403, "School administrator access is required");
  }

  const data = await transaction((connection) => dashboardSnapshot(connection, schoolId));
  res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
  return sendData(res, data);
}
