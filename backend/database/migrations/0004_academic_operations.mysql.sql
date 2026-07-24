-- v0.3.0 Academic Operations Foundation

ALTER TABLE academic_terms
  ADD UNIQUE KEY uq_academic_terms_id_school (id, school_id);
ALTER TABLE student_enrollments
  ADD UNIQUE KEY uq_student_enrollments_id_school (id, school_id);
ALTER TABLE subjects
  ADD UNIQUE KEY uq_subjects_id_school (id, school_id);
ALTER TABLE teachers
  ADD UNIQUE KEY uq_teachers_id_school (id, school_id);

CREATE TABLE admission_applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  requested_class_id CHAR(36) NULL,
  application_number VARCHAR(100) NOT NULL,
  applicant_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('male', 'female', 'other', 'unspecified') NOT NULL DEFAULT 'unspecified',
  guardian_name VARCHAR(255) NOT NULL,
  guardian_email VARCHAR(255) NULL,
  guardian_phone VARCHAR(50) NOT NULL,
  address TEXT NULL,
  previous_school VARCHAR(255) NULL,
  status ENUM('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted', 'withdrawn') NOT NULL DEFAULT 'submitted',
  decision_notes TEXT NULL,
  decided_by CHAR(36) NULL,
  decided_at DATETIME NULL,
  student_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admissions_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_admissions_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admissions_class_school FOREIGN KEY (requested_class_id, school_id)
    REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admissions_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_admissions_student_school FOREIGN KEY (student_id, school_id)
    REFERENCES students(id, school_id) ON DELETE RESTRICT,
  UNIQUE KEY uq_admissions_school_number (school_id, application_number),
  INDEX idx_admissions_school_year_status (school_id, academic_year_id, status),
  INDEX idx_admissions_guardian_email (guardian_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE class_offerings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  class_id CHAR(36) NOT NULL,
  homeroom_teacher_id CHAR(36) NULL,
  capacity INT UNSIGNED NULL,
  status ENUM('planned', 'active', 'closed', 'cancelled') NOT NULL DEFAULT 'planned',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_class_offerings_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_class_offerings_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_class_offerings_class_school FOREIGN KEY (class_id, school_id)
    REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_class_offerings_teacher_school FOREIGN KEY (homeroom_teacher_id, school_id)
    REFERENCES teachers(id, school_id) ON DELETE RESTRICT,
  UNIQUE KEY uq_class_offerings_year_class (academic_year_id, class_id),
  UNIQUE KEY uq_class_offerings_id_school (id, school_id),
  INDEX idx_class_offerings_school_year_status (school_id, academic_year_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subject_offerings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  academic_term_id CHAR(36) NULL,
  term_scope_key CHAR(36) GENERATED ALWAYS AS
    (COALESCE(academic_term_id, '00000000-0000-0000-0000-000000000000')) STORED,
  class_offering_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  teacher_id CHAR(36) NULL,
  credits DECIMAL(6,2) NULL,
  maximum_marks DECIMAL(8,2) NOT NULL DEFAULT 100,
  pass_marks DECIMAL(8,2) NOT NULL DEFAULT 40,
  is_optional TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('planned', 'active', 'closed', 'cancelled') NOT NULL DEFAULT 'planned',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subject_offerings_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_subject_offerings_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_subject_offerings_term_school FOREIGN KEY (academic_term_id, school_id)
    REFERENCES academic_terms(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_subject_offerings_class_school FOREIGN KEY (class_offering_id, school_id)
    REFERENCES class_offerings(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_subject_offerings_subject_school FOREIGN KEY (subject_id, school_id)
    REFERENCES subjects(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_subject_offerings_teacher_school FOREIGN KEY (teacher_id, school_id)
    REFERENCES teachers(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_subject_offering_marks CHECK (maximum_marks > 0 AND pass_marks >= 0 AND pass_marks <= maximum_marks),
  UNIQUE KEY uq_subject_offerings_scope (class_offering_id, term_scope_key, subject_id),
  UNIQUE KEY uq_subject_offerings_id_school (id, school_id),
  INDEX idx_subject_offerings_school_year (school_id, academic_year_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assessment_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  weight_percent DECIMAL(5,2) NOT NULL,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessment_categories_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_categories_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  CONSTRAINT chk_assessment_category_weight CHECK (weight_percent > 0 AND weight_percent <= 100),
  UNIQUE KEY uq_assessment_categories_year_name (academic_year_id, name),
  UNIQUE KEY uq_assessment_categories_year_sequence (academic_year_id, sequence_number),
  UNIQUE KEY uq_assessment_categories_id_school (id, school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grading_scales (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NULL,
  name VARCHAR(100) NOT NULL,
  scale_type ENUM('percentage', 'gpa', 'points') NOT NULL DEFAULT 'percentage',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_grading_scales_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_grading_scales_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE CASCADE,
  UNIQUE KEY uq_grading_scales_school_name (school_id, name),
  UNIQUE KEY uq_grading_scales_id_school (id, school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grading_scale_bands (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  grading_scale_id CHAR(36) NOT NULL,
  label VARCHAR(30) NOT NULL,
  minimum_value DECIMAL(8,2) NOT NULL,
  maximum_value DECIMAL(8,2) NOT NULL,
  grade_point DECIMAL(5,2) NULL,
  is_passing TINYINT(1) NOT NULL DEFAULT 1,
  sequence_number SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_grading_bands_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_grading_bands_scale_school FOREIGN KEY (grading_scale_id, school_id)
    REFERENCES grading_scales(id, school_id) ON DELETE CASCADE,
  CONSTRAINT chk_grading_band_range CHECK (maximum_value >= minimum_value),
  UNIQUE KEY uq_grading_bands_scale_label (grading_scale_id, label),
  UNIQUE KEY uq_grading_bands_scale_sequence (grading_scale_id, sequence_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assessments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  academic_term_id CHAR(36) NOT NULL,
  subject_offering_id CHAR(36) NOT NULL,
  assessment_category_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  assessment_date DATE NULL,
  maximum_score DECIMAL(8,2) NOT NULL,
  weight_percent DECIMAL(5,2) NULL,
  status ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'draft',
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessments_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessments_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assessments_term_school FOREIGN KEY (academic_term_id, school_id)
    REFERENCES academic_terms(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assessments_subject_school FOREIGN KEY (subject_offering_id, school_id)
    REFERENCES subject_offerings(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assessments_category_school FOREIGN KEY (assessment_category_id, school_id)
    REFERENCES assessment_categories(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_assessments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_assessments_score CHECK (maximum_score > 0),
  UNIQUE KEY uq_assessments_offering_title (subject_offering_id, academic_term_id, title),
  UNIQUE KEY uq_assessments_id_school (id, school_id),
  INDEX idx_assessments_school_term_status (school_id, academic_term_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE assessment_scores (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  assessment_id CHAR(36) NOT NULL,
  student_enrollment_id CHAR(36) NOT NULL,
  score DECIMAL(8,2) NULL,
  status ENUM('pending', 'graded', 'absent', 'excused') NOT NULL DEFAULT 'pending',
  feedback TEXT NULL,
  graded_by CHAR(36) NULL,
  graded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_assessment_scores_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_assessment_school FOREIGN KEY (assessment_id, school_id)
    REFERENCES assessments(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_enrollment_school FOREIGN KEY (student_enrollment_id, school_id)
    REFERENCES student_enrollments(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_scores_grader FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_assessment_scores_nonnegative CHECK (score IS NULL OR score >= 0),
  UNIQUE KEY uq_assessment_scores_assessment_enrollment (assessment_id, student_enrollment_id),
  INDEX idx_assessment_scores_enrollment (student_enrollment_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_cards (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  student_enrollment_id CHAR(36) NOT NULL,
  academic_term_id CHAR(36) NOT NULL,
  grading_scale_id CHAR(36) NULL,
  status ENUM('draft', 'review', 'approved', 'published', 'recalled') NOT NULL DEFAULT 'draft',
  total_score DECIMAL(10,2) NULL,
  percentage DECIMAL(6,2) NULL,
  overall_grade VARCHAR(30) NULL,
  grade_point DECIMAL(5,2) NULL,
  attendance_present INT UNSIGNED NULL,
  attendance_total INT UNSIGNED NULL,
  teacher_comment TEXT NULL,
  approved_by CHAR(36) NULL,
  approved_at DATETIME NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_cards_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_cards_enrollment_school FOREIGN KEY (student_enrollment_id, school_id)
    REFERENCES student_enrollments(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_report_cards_term_school FOREIGN KEY (academic_term_id, school_id)
    REFERENCES academic_terms(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_cards_scale_school FOREIGN KEY (grading_scale_id, school_id)
    REFERENCES grading_scales(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_cards_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_report_cards_enrollment_term (student_enrollment_id, academic_term_id),
  UNIQUE KEY uq_report_cards_id_school (id, school_id),
  INDEX idx_report_cards_school_term_status (school_id, academic_term_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report_card_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  report_card_id CHAR(36) NOT NULL,
  subject_offering_id CHAR(36) NOT NULL,
  score DECIMAL(10,2) NULL,
  maximum_score DECIMAL(10,2) NULL,
  percentage DECIMAL(6,2) NULL,
  grade_label VARCHAR(30) NULL,
  grade_point DECIMAL(5,2) NULL,
  teacher_comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_items_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_items_card_school FOREIGN KEY (report_card_id, school_id)
    REFERENCES report_cards(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_report_items_subject_school FOREIGN KEY (subject_offering_id, school_id)
    REFERENCES subject_offerings(id, school_id) ON DELETE RESTRICT,
  UNIQUE KEY uq_report_items_card_subject (report_card_id, subject_offering_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardian_invitations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  relationship_type ENUM('father', 'mother', 'legal_guardian', 'grandparent', 'sibling', 'relative', 'other') NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  invited_by CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_by CHAR(36) NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_guardian_invitations_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_guardian_invitations_student_school FOREIGN KEY (student_id, school_id)
    REFERENCES students(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_guardian_invitations_inviter FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_guardian_invitations_acceptor FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_guardian_invitations_pending_target (student_id, email, status),
  INDEX idx_guardian_invitations_school_status (school_id, status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE timetable
  ADD COLUMN academic_year_id CHAR(36) NULL AFTER school_id,
  ADD COLUMN academic_term_id CHAR(36) NULL AFTER academic_year_id,
  ADD COLUMN class_offering_id CHAR(36) NULL AFTER academic_term_id,
  ADD CONSTRAINT fk_timetable_year_school FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_timetable_term_school FOREIGN KEY (academic_term_id, school_id) REFERENCES academic_terms(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_timetable_class_offering_school FOREIGN KEY (class_offering_id, school_id) REFERENCES class_offerings(id, school_id) ON DELETE RESTRICT,
  ADD INDEX idx_timetable_year_term (school_id, academic_year_id, academic_term_id);

ALTER TABLE attendance
  ADD COLUMN academic_year_id CHAR(36) NULL AFTER school_id,
  ADD COLUMN academic_term_id CHAR(36) NULL AFTER academic_year_id,
  ADD COLUMN student_enrollment_id CHAR(36) NULL AFTER academic_term_id,
  ADD COLUMN attendance_status ENUM('present', 'absent', 'late', 'excused', 'remote') NULL AFTER is_present,
  ADD CONSTRAINT fk_attendance_year_school FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_attendance_term_school FOREIGN KEY (academic_term_id, school_id) REFERENCES academic_terms(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_attendance_enrollment_school FOREIGN KEY (student_enrollment_id, school_id) REFERENCES student_enrollments(id, school_id) ON DELETE CASCADE,
  ADD INDEX idx_attendance_enrollment_date (student_enrollment_id, date);
