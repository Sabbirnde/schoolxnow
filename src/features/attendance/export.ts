import type { AttendanceRecord, AttendanceStudent } from "./types";

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export function attendanceCsv(
  students: AttendanceStudent[],
  attendance: AttendanceRecord[],
) {
  const byStudent = new Map(
    attendance.map((record) => [record.student_id, record]),
  );
  const lines = [
    ["Student ID", "Student Name", "Status", "Remarks"].map(csvCell).join(","),
  ];
  for (const student of students) {
    const record = byStudent.get(student.id);
    lines.push(
      [
        student.student_id,
        student.full_name,
        record ? (record.is_present ? "Present" : "Absent") : "Not marked",
        record?.remarks || "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

export function downloadAttendanceCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
