import type {
  AttendanceClass,
  AttendanceRecord,
  AttendanceStudent,
  AttendanceSummary,
} from "./types";

export const attachClassesToStudents = (
  studentRows: AttendanceStudent[],
  classRows: AttendanceClass[],
): AttendanceStudent[] => {
  const classById = new Map(
    classRows.map((classItem) => [classItem.id, classItem]),
  );
  return studentRows.map((student) => {
    const classItem = classById.get(student.class_id);
    return {
      ...student,
      classes: classItem
        ? { id: classItem.id, name: classItem.name, section: classItem.section }
        : undefined,
    };
  });
};

export const attachStudentsToAttendance = (
  records: AttendanceRecord[],
  studentRows: AttendanceStudent[],
): AttendanceRecord[] => {
  const studentById = new Map(
    studentRows.map((student) => [student.id, student]),
  );
  return records.map((record) => ({
    ...record,
    is_present: Boolean(record.is_present),
    student: studentById.get(record.student_id),
  }));
};

export const calculateAttendanceSummary = (
  students: AttendanceStudent[],
  attendance: AttendanceRecord[],
): AttendanceSummary => {
  const total = students.length;
  const marked = attendance.length;
  const present = attendance.filter((record) => record.is_present).length;
  const absent = marked - present;
  return {
    total,
    marked,
    present,
    absent,
    percentage: total > 0 ? ((present / total) * 100).toFixed(1) : "0",
    completionPercentage: total > 0 ? (marked / total) * 100 : 0,
  };
};
