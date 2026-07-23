-- SchoolXNow PHP/MySQL shared-hosting schema
-- Import this file in phpMyAdmin or the MySQL CLI before using the PHP API.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email_verified_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_password_reset_tokens_user_id (user_id),
  INDEX idx_password_reset_tokens_hash (token_hash),
  INDEX idx_password_reset_tokens_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE api_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  action VARCHAR(64) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 1,
  window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_api_rate_limits_expires_at (expires_at),
  INDEX idx_api_rate_limits_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schools (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_bangla VARCHAR(255) NULL,
  school_type ENUM('bangla_medium', 'english_medium', 'madrasha') NOT NULL,
  address TEXT NOT NULL,
  address_bangla TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  eiin_number VARCHAR(100) NULL UNIQUE,
  established_year INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  school_id CHAR(36) NULL,
  role ENUM('super_admin', 'school_admin', 'teacher', 'student', 'guardian') NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  full_name_bangla VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  avatar_url TEXT NULL,
  address TEXT NULL,
  address_bangla TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  approval_status VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_profiles_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  INDEX idx_user_profiles_school_id (school_id),
  INDEX idx_user_profiles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teacher_portal_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_portal_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_teacher_portal_tokens_user_id (user_id),
  INDEX idx_teacher_portal_tokens_hash (token_hash),
  INDEX idx_teacher_portal_tokens_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  role ENUM('super_admin', 'school_admin', 'teacher', 'student', 'guardian') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_roles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE classes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_bangla VARCHAR(255) NULL,
  class_level ENUM(
    'nursery', 'kg', 'class_1', 'class_2', 'class_3', 'class_4', 'class_5',
    'class_6', 'class_7', 'class_8', 'class_9', 'class_10', 'class_11', 'class_12',
    'alim', 'fazil', 'kamil'
  ) NOT NULL,
  section VARCHAR(30) NOT NULL DEFAULT 'A',
  capacity INT NULL DEFAULT 40,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_classes_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  UNIQUE KEY uq_classes_school_level_section (school_id, class_level, section),
  INDEX idx_classes_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  class_id CHAR(36) NULL,
  student_id VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  full_name_bangla VARCHAR(255) NULL,
  father_name VARCHAR(255) NOT NULL,
  father_name_bangla VARCHAR(255) NULL,
  mother_name VARCHAR(255) NOT NULL,
  mother_name_bangla VARCHAR(255) NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('male', 'female') NOT NULL,
  blood_group VARCHAR(20) NULL,
  address TEXT NOT NULL,
  address_bangla TEXT NULL,
  guardian_phone VARCHAR(50) NOT NULL,
  guardian_email VARCHAR(255) NULL,
  admission_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  status ENUM('active', 'inactive', 'graduated', 'transferred') NOT NULL DEFAULT 'active',
  photo_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  UNIQUE KEY uq_students_school_student_id (school_id, student_id),
  INDEX idx_students_school_id (school_id),
  INDEX idx_students_class_id (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subjects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_bangla VARCHAR(255) NULL,
  code VARCHAR(100) NOT NULL,
  class_level ENUM(
    'nursery', 'kg', 'class_1', 'class_2', 'class_3', 'class_4', 'class_5',
    'class_6', 'class_7', 'class_8', 'class_9', 'class_10', 'class_11', 'class_12',
    'alim', 'fazil', 'kamil'
  ) NOT NULL,
  is_optional TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subjects_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  UNIQUE KEY uq_subjects_school_code_level (school_id, code, class_level),
  INDEX idx_subjects_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teachers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  school_id CHAR(36) NOT NULL,
  teacher_id VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  full_name_bangla VARCHAR(255) NULL,
  designation VARCHAR(255) NULL,
  qualification TEXT NULL,
  subject_specialization TEXT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  address_bangla TEXT NULL,
  joining_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_teachers_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  UNIQUE KEY uq_teachers_school_teacher_id (school_id, teacher_id),
  INDEX idx_teachers_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  class_id CHAR(36) NOT NULL,
  date DATE NOT NULL,
  is_present TINYINT(1) NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_attendance_student_date (student_id, date),
  INDEX idx_attendance_school_date (school_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exams (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_bangla VARCHAR(255) NULL,
  class_level ENUM(
    'nursery', 'kg', 'class_1', 'class_2', 'class_3', 'class_4', 'class_5',
    'class_6', 'class_7', 'class_8', 'class_9', 'class_10', 'class_11', 'class_12',
    'alim', 'fazil', 'kamil'
  ) NOT NULL,
  exam_date DATE NOT NULL,
  total_marks INT NOT NULL DEFAULT 100,
  pass_marks INT NOT NULL DEFAULT 40,
  exam_status VARCHAR(50) NOT NULL DEFAULT 'active',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_exams_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  INDEX idx_exams_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exam_results (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  exam_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  obtained_marks INT NOT NULL,
  total_marks INT NOT NULL,
  grade VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_exam_results_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_results_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_results_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_results_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_exam_results_exam_student_subject (exam_id, student_id, subject_id),
  INDEX idx_exam_results_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE timetable (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  class_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  teacher_id CHAR(36) NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_timetable_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_timetable_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_timetable_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_timetable_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
  INDEX idx_timetable_school_id (school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE teacher_applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  school_id CHAR(36) NULL,
  full_name VARCHAR(255) NOT NULL,
  full_name_bangla VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  address TEXT NULL,
  address_bangla TEXT NULL,
  subject_specialization TEXT NULL,
  qualification TEXT NULL,
  experience_years INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  application_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_applications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_teacher_applications_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_teacher_applications_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  INDEX idx_teacher_applications_user_id (user_id),
  INDEX idx_teacher_applications_school_id (school_id),
  INDEX idx_teacher_applications_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  school_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id CHAR(36) NULL,
  new_values JSON NULL,
  metadata JSON NULL,
  success TINYINT(1) NOT NULL DEFAULT 1,
  error_message TEXT NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_school_id (school_id),
  INDEX idx_audit_logs_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  setting_key VARCHAR(150) NOT NULL UNIQUE,
  setting_value JSON NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_school_id (school_id),
  INDEX idx_notifications_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NULL,
  user_id CHAR(36) NOT NULL,
  settings JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_settings_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_notification_settings_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE feedback_submissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  category VARCHAR(100) NULL,
  rating INT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_submissions_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedback_submissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_feedback_submissions_school_id (school_id),
  INDEX idx_feedback_submissions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Academic foundation (migration 0003)
ALTER TABLE classes
  ADD UNIQUE KEY uq_classes_id_school (id, school_id);
ALTER TABLE students
  ADD COLUMN user_id CHAR(36) NULL AFTER school_id,
  ADD CONSTRAINT fk_students_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL,
  ADD UNIQUE KEY uq_students_user_id (user_id),
  ADD UNIQUE KEY uq_students_id_school (id, school_id);

CREATE TABLE academic_years (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('planned', 'active', 'closed') NOT NULL DEFAULT 'planned',
  current_school_id CHAR(36) GENERATED ALWAYS AS
    (CASE WHEN status = 'active' THEN school_id ELSE NULL END) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_academic_years_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT,
  CONSTRAINT chk_academic_years_dates CHECK (end_date >= start_date),
  UNIQUE KEY uq_academic_years_school_name (school_id, name),
  UNIQUE KEY uq_academic_years_single_active (current_school_id),
  UNIQUE KEY uq_academic_years_id_school (id, school_id),
  INDEX idx_academic_years_school_status (school_id, status),
  INDEX idx_academic_years_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE academic_terms (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('planned', 'active', 'closed') NOT NULL DEFAULT 'planned',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_academic_terms_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_academic_terms_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT chk_academic_terms_dates CHECK (end_date >= start_date),
  UNIQUE KEY uq_academic_terms_year_name (academic_year_id, name),
  UNIQUE KEY uq_academic_terms_year_sequence (academic_year_id, sequence_number),
  INDEX idx_academic_terms_school_status (school_id, status),
  INDEX idx_academic_terms_year_dates (academic_year_id, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_enrollments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  class_id CHAR(36) NULL,
  roll_number VARCHAR(50) NULL,
  status ENUM('pending', 'active', 'promoted', 'repeated', 'transferred', 'withdrawn', 'graduated') NOT NULL DEFAULT 'pending',
  enrolled_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  ended_on DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_enrollments_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_enrollments_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_student_enrollments_student_school FOREIGN KEY (student_id, school_id)
    REFERENCES students(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_enrollments_class_school FOREIGN KEY (class_id, school_id)
    REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_student_enrollments_dates CHECK (ended_on IS NULL OR ended_on >= enrolled_on),
  UNIQUE KEY uq_student_enrollments_student_year (student_id, academic_year_id),
  UNIQUE KEY uq_student_enrollments_roll (school_id, academic_year_id, class_id, roll_number),
  INDEX idx_student_enrollments_school_year_status (school_id, academic_year_id, status),
  INDEX idx_student_enrollments_class (class_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardian_relationships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  guardian_user_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  relationship_type ENUM('father', 'mother', 'legal_guardian', 'grandparent', 'sibling', 'relative', 'other') NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  has_portal_access TINYINT(1) NOT NULL DEFAULT 1,
  can_pick_up TINYINT(1) NOT NULL DEFAULT 0,
  is_emergency_contact TINYINT(1) NOT NULL DEFAULT 0,
  receives_academic_updates TINYINT(1) NOT NULL DEFAULT 1,
  receives_financial_updates TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_guardian_relationships_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_guardian_relationships_guardian FOREIGN KEY (guardian_user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_guardian_relationships_student_school FOREIGN KEY (student_id, school_id)
    REFERENCES students(id, school_id) ON DELETE CASCADE,
  UNIQUE KEY uq_guardian_relationships_guardian_student (guardian_user_id, student_id),
  INDEX idx_guardian_relationships_student (student_id, is_primary),
  INDEX idx_guardian_relationships_guardian_access (guardian_user_id, has_portal_access)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
