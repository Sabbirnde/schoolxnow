import { format } from "date-fns";
import { apiClient } from "@/integrations/php-api/api-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";
import type { AttendanceRecord } from "./types";

export async function replaceAttendance(input: {
  schoolId: string;
  classId: string;
  date: Date;
  records: AttendanceRecord[];
}) {
  const date = format(input.date, "yyyy-MM-dd");
  const rows = input.records.map((record) => ({
    school_id: input.schoolId,
    student_id: record.student_id,
    class_id: record.class_id,
    date: record.date,
    is_present: record.is_present,
    remarks: record.remarks || null,
  }));

  if (isPhpBackend) {
    const existing = await phpApi.table<AttendanceRecord>("attendance").list({
      select: "id",
      class_id: input.classId,
      date,
      limit: 200,
    });
    await Promise.all(
      existing.flatMap((record) =>
        record.id
          ? [phpApi.table<AttendanceRecord>("attendance").delete(record.id)]
          : [],
      ),
    );
    await Promise.all(
      rows.map((record) =>
        phpApi.table<AttendanceRecord>("attendance").create(record),
      ),
    );
    return;
  }

  const { error: deleteError } = await apiClient
    .from("attendance")
    .delete()
    .eq("class_id", input.classId)
    .eq("date", date);
  if (deleteError) throw deleteError;
  const { error } = await apiClient.from("attendance").insert(rows);
  if (error) throw error;
}
