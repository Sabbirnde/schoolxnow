import { describe, expect, it } from "vitest";
import { attendanceCsv } from "./export";
import {
  attachClassesToStudents,
  attachStudentsToAttendance,
  calculateAttendanceSummary,
} from "./queries";

const students = [
  { id: "s1", student_id: "001", full_name: "Ada", class_id: "c1" },
  { id: "s2", student_id: "002", full_name: "Lin", class_id: "c1" },
];

describe("attendance feature calculations", () => {
  it("joins class and student data without N+1 requests", () => {
    const joinedStudents = attachClassesToStudents(students, [
      { id: "c1", name: "Grade 1", section: "A", class_level: "1" },
    ]);
    expect(joinedStudents[0].classes?.name).toBe("Grade 1");

    const records = attachStudentsToAttendance(
      [
        {
          student_id: "s1",
          class_id: "c1",
          date: "2026-07-24",
          is_present: 1 as unknown as boolean,
        },
      ],
      joinedStudents,
    );
    expect(records[0].student?.full_name).toBe("Ada");
    expect(records[0].is_present).toBe(true);
  });

  it("calculates summaries independently from rendering", () => {
    expect(
      calculateAttendanceSummary(students, [
        {
          student_id: "s1",
          class_id: "c1",
          date: "2026-07-24",
          is_present: true,
        },
        {
          student_id: "s2",
          class_id: "c1",
          date: "2026-07-24",
          is_present: false,
        },
      ]),
    ).toEqual({
      total: 2,
      marked: 2,
      present: 1,
      absent: 1,
      percentage: "50.0",
      completionPercentage: 100,
    });
  });

  it("exports marked and unmarked students safely as CSV", () => {
    const csv = attendanceCsv(students, [
      {
        student_id: "s1",
        class_id: "c1",
        date: "2026-07-24",
        is_present: true,
        remarks: 'On "time"',
      },
    ]);
    expect(csv).toContain('"Present","On ""time"""');
    expect(csv).toContain('"002","Lin","Not marked",""');
  });
});
