-- v0.4.x MySQL query performance hardening.
-- Composite indexes follow the left-most prefixes used by school-scoped API queries.

ALTER TABLE students
  ADD INDEX idx_students_school_status (school_id, status),
  ADD INDEX idx_students_school_admission (school_id, admission_date);

ALTER TABLE teachers
  ADD INDEX idx_teachers_school_active (school_id, is_active);

ALTER TABLE classes
  ADD INDEX idx_classes_school_active (school_id, is_active);

ALTER TABLE subjects
  ADD INDEX idx_subjects_school_active (school_id, is_active);

ALTER TABLE attendance
  ADD INDEX idx_attendance_school_date_class (school_id, date, class_id);

ALTER TABLE exam_results
  ADD INDEX idx_exam_results_school_exam_student (school_id, exam_id, student_id);

ALTER TABLE student_invoices
  ADD INDEX idx_student_invoices_school_status_due (school_id, status, due_date);

ALTER TABLE exams
  ADD INDEX idx_exams_school_active_date (school_id, is_active, exam_date);

ALTER TABLE teacher_applications
  ADD INDEX idx_teacher_applications_school_status (school_id, status);

ALTER TABLE audit_logs
  ADD INDEX idx_audit_logs_school_timestamp (school_id, timestamp);
