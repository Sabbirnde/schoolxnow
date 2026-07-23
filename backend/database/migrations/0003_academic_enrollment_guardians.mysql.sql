-- Academic year, enrollment, and guardian relationship foundation.
-- Provides the historical model required by admissions, promotion,
-- report cards, and guardian portal access.

ALTER TABLE classes
  ADD UNIQUE KEY uq_classes_id_school (id, school_id);

ALTER TABLE students
  ADD COLUMN user_id CHAR(36) NULL AFTER school_id,
  ADD CONSTRAINT fk_students_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD UNIQUE KEY uq_students_user_id (user_id),
  ADD UNIQUE KEY uq_students_id_school (id, school_id);

CREATE TABLE academic_years (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('planned', 'active', 'closed') NOT NULL DEFAULT 'planned',
  current_school_id CHAR(36)
    GENERATED ALWAYS AS (
      CASE WHEN status = 'active' THEN school_id ELSE NULL END
    ) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_academic_years_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT,
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
  CONSTRAINT fk_academic_terms_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_academic_terms_year_school
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id)
    ON DELETE CASCADE,
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
  status ENUM(
    'pending', 'active', 'promoted', 'repeated',
    'transferred', 'withdrawn', 'graduated'
  ) NOT NULL DEFAULT 'pending',
  enrolled_on DATE NOT NULL DEFAULT (CURRENT_DATE),
  ended_on DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_enrollments_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_enrollments_year_school
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_student_enrollments_student_school
    FOREIGN KEY (student_id, school_id)
    REFERENCES students(id, school_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_student_enrollments_class_school
    FOREIGN KEY (class_id, school_id)
    REFERENCES classes(id, school_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_student_enrollments_dates
    CHECK (ended_on IS NULL OR ended_on >= enrolled_on),
  UNIQUE KEY uq_student_enrollments_student_year (student_id, academic_year_id),
  UNIQUE KEY uq_student_enrollments_roll
    (school_id, academic_year_id, class_id, roll_number),
  INDEX idx_student_enrollments_school_year_status
    (school_id, academic_year_id, status),
  INDEX idx_student_enrollments_class (class_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE guardian_relationships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  guardian_user_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  relationship_type ENUM(
    'father', 'mother', 'legal_guardian', 'grandparent',
    'sibling', 'relative', 'other'
  ) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  has_portal_access TINYINT(1) NOT NULL DEFAULT 1,
  can_pick_up TINYINT(1) NOT NULL DEFAULT 0,
  is_emergency_contact TINYINT(1) NOT NULL DEFAULT 0,
  receives_academic_updates TINYINT(1) NOT NULL DEFAULT 1,
  receives_financial_updates TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_guardian_relationships_school
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_guardian_relationships_guardian
    FOREIGN KEY (guardian_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_guardian_relationships_student_school
    FOREIGN KEY (student_id, school_id)
    REFERENCES students(id, school_id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_guardian_relationships_guardian_student
    (guardian_user_id, student_id),
  INDEX idx_guardian_relationships_student (student_id, is_primary),
  INDEX idx_guardian_relationships_guardian_access
    (guardian_user_id, has_portal_access)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
