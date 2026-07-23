import { describe, expect, it, vi } from 'vitest';
import { buildTodaySchedule } from './useTeacherDashboardData';

vi.mock('@/integrations/php-api/api-client', () => ({
  apiClient: {
    from: vi.fn(),
  },
}));

type TimetableEntries = Parameters<typeof buildTodaySchedule>[0];
type ClassEntries = Parameters<typeof buildTodaySchedule>[1];
type SubjectEntries = Parameters<typeof buildTodaySchedule>[2];

describe('useTeacherDashboardData helpers', () => {
  it('builds sorted today schedule with current, completed, and upcoming statuses', () => {
    const now = new Date(2026, 6, 6, 10, 30, 0);
    const timetable = [
      {
        id: 't3',
        school_id: 'school-1',
        class_id: 'class-1',
        subject_id: 'subject-1',
        teacher_id: 'teacher-1',
        day_of_week: 'monday',
        time_slot: '12:00-13:00',
        room_number: '203',
        is_active: true,
        created_at: '2026-07-06T00:00:00.000Z',
      },
      {
        id: 't1',
        school_id: 'school-1',
        class_id: 'class-1',
        subject_id: 'subject-1',
        teacher_id: 'teacher-1',
        day_of_week: 'monday',
        time_slot: '09:00-10:00',
        room_number: '201',
        is_active: true,
        created_at: '2026-07-06T00:00:00.000Z',
      },
      {
        id: 't2',
        school_id: 'school-1',
        class_id: 'class-2',
        subject_id: 'subject-2',
        teacher_id: 'teacher-1',
        day_of_week: 'monday',
        time_slot: '10:00-11:00',
        room_number: null,
        is_active: true,
        created_at: '2026-07-06T00:00:00.000Z',
      },
      {
        id: 'not-today',
        school_id: 'school-1',
        class_id: 'class-1',
        subject_id: 'subject-1',
        teacher_id: 'teacher-1',
        day_of_week: 'tuesday',
        time_slot: '08:00-09:00',
        room_number: '200',
        is_active: true,
        created_at: '2026-07-06T00:00:00.000Z',
      },
    ] satisfies TimetableEntries;
    const classes = [
      { id: 'class-1', name: 'Class 8', section: 'A' },
      { id: 'class-2', name: 'Class 9', section: null },
    ] satisfies ClassEntries;
    const subjects = [
      { id: 'subject-1', name: 'Math' },
      { id: 'subject-2', name: 'Science' },
    ] satisfies SubjectEntries;

    const schedule = buildTodaySchedule(timetable, classes, subjects, now);

    expect(schedule.map((item) => item.time)).toEqual([
      '09:00-10:00',
      '10:00-11:00',
      '12:00-13:00',
    ]);
    expect(schedule.map((item) => item.status)).toEqual([
      'completed',
      'current',
      'upcoming',
    ]);
    expect(schedule[0]).toMatchObject({
      subject: 'Math',
      class: 'Class 8 A',
      room_number: '201',
      class_id: 'class-1',
    });
    expect(schedule[1]).toMatchObject({
      subject: 'Science',
      class: 'Class 9',
    });
  });
});
