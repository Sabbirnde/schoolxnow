-- v0.4.0 Fees, Billing, and Payments

CREATE TABLE fee_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fee_categories_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  UNIQUE KEY uq_fee_categories_school_code (school_id, code),
  UNIQUE KEY uq_fee_categories_id_school (id, school_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fee_plans (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  academic_year_id CHAR(36) NOT NULL,
  class_id CHAR(36) NULL,
  name VARCHAR(150) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  billing_frequency ENUM('one_time', 'monthly', 'termly', 'quarterly', 'annual') NOT NULL DEFAULT 'one_time',
  status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fee_plans_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_fee_plans_year_school FOREIGN KEY (academic_year_id, school_id)
    REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_plans_class_school FOREIGN KEY (class_id, school_id)
    REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  UNIQUE KEY uq_fee_plans_school_year_name (school_id, academic_year_id, name),
  UNIQUE KEY uq_fee_plans_id_school (id, school_id),
  INDEX idx_fee_plans_school_year_status (school_id, academic_year_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fee_plan_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  fee_plan_id CHAR(36) NOT NULL,
  fee_category_id CHAR(36) NOT NULL,
  description VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_offset_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_optional TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fee_plan_items_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_fee_plan_items_plan_school FOREIGN KEY (fee_plan_id, school_id)
    REFERENCES fee_plans(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_fee_plan_items_category_school FOREIGN KEY (fee_category_id, school_id)
    REFERENCES fee_categories(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_fee_plan_items_amount CHECK (amount >= 0),
  UNIQUE KEY uq_fee_plan_items_plan_category (fee_plan_id, fee_category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_invoices (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  student_enrollment_id CHAR(36) NOT NULL,
  fee_plan_id CHAR(36) NULL,
  invoice_number VARCHAR(80) NOT NULL,
  currency CHAR(3) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void') NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  adjustment_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  issued_by CHAR(36) NULL,
  issued_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_invoices_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_invoices_enrollment_school FOREIGN KEY (student_enrollment_id, school_id)
    REFERENCES student_enrollments(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_student_invoices_plan_school FOREIGN KEY (fee_plan_id, school_id)
    REFERENCES fee_plans(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_student_invoices_issuer FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_student_invoices_dates CHECK (due_date >= issue_date),
  CONSTRAINT chk_student_invoices_amounts CHECK (
    subtotal >= 0 AND discount_total >= 0 AND total_amount >= 0 AND paid_amount >= 0 AND balance_amount >= 0
  ),
  UNIQUE KEY uq_student_invoices_school_number (school_id, invoice_number),
  UNIQUE KEY uq_student_invoices_plan_enrollment_dates
    (fee_plan_id, student_enrollment_id, issue_date, due_date),
  UNIQUE KEY uq_student_invoices_id_school (id, school_id),
  INDEX idx_student_invoices_enrollment_status (student_enrollment_id, status),
  INDEX idx_student_invoices_school_due (school_id, due_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_invoice_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  student_invoice_id CHAR(36) NOT NULL,
  fee_category_id CHAR(36) NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_amount DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_items_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_invoice_school FOREIGN KEY (student_invoice_id, school_id)
    REFERENCES student_invoices(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_category_school FOREIGN KEY (fee_category_id, school_id)
    REFERENCES fee_categories(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_invoice_items_amounts CHECK (
    quantity > 0 AND unit_amount >= 0 AND discount_amount >= 0 AND line_total >= 0
  ),
  INDEX idx_invoice_items_invoice (student_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  receipt_number VARCHAR(80) NOT NULL,
  payer_user_id CHAR(36) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  payment_method ENUM('cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'online', 'other') NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded', 'void') NOT NULL DEFAULT 'completed',
  paid_at DATETIME NOT NULL,
  external_reference VARCHAR(150) NULL,
  notes TEXT NULL,
  recorded_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_payer FOREIGN KEY (payer_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_recorder FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  UNIQUE KEY uq_payments_school_receipt (school_id, receipt_number),
  UNIQUE KEY uq_payments_id_school (id, school_id),
  INDEX idx_payments_school_date_status (school_id, paid_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_allocations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  payment_id CHAR(36) NOT NULL,
  student_invoice_id CHAR(36) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_allocations_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_allocations_payment_school FOREIGN KEY (payment_id, school_id)
    REFERENCES payments(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_allocations_invoice_school FOREIGN KEY (student_invoice_id, school_id)
    REFERENCES student_invoices(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT chk_payment_allocations_amount CHECK (amount > 0),
  UNIQUE KEY uq_payment_allocations_payment_invoice (payment_id, student_invoice_id),
  INDEX idx_payment_allocations_invoice (student_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_adjustments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  school_id CHAR(36) NOT NULL,
  student_invoice_id CHAR(36) NOT NULL,
  adjustment_type ENUM('discount', 'charge', 'waiver', 'credit') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  approved_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_adjustments_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_adjustments_invoice_school FOREIGN KEY (student_invoice_id, school_id)
    REFERENCES student_invoices(id, school_id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_adjustments_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_invoice_adjustments_amount CHECK (amount > 0),
  INDEX idx_invoice_adjustments_invoice (student_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
