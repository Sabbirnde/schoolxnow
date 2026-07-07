-- SchoolXNow local/demo login seed.
-- Import after backend/database/schema.mysql.sql.
-- These credentials are for development and test databases only.

SET NAMES utf8mb4;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

SET @super_admin_email = 'admin@schoolxnow.local';
SET @super_admin_password_hash = '$2y$12$YTdDySvIaEc6B7MUUc8wfe/owUPM1PG9NjWrqB49n/h2D/WbcGc3W';
SET @super_admin_name = 'Super Admin';
SET @new_super_admin_user_id = '00000000-0000-4000-8000-000000000001';
SET @new_super_admin_profile_id = '00000000-0000-4000-8000-000000000002';
SET @new_super_admin_role_id = '00000000-0000-4000-8000-000000000003';

SET @demo_school_email = 'school@schoolxnow.local';
SET @demo_school_eiin = '123456';
SET @new_demo_school_id = '00000000-0000-4000-8000-000000000010';

SET @school_admin_email = 'schooladmin@schoolxnow.local';
SET @school_admin_password_hash = '$2y$12$hM9SGU4tw6Lu4hHRECOineOx0nRSV2aUgHuUmr.JiH4Qn7BFnxdBm';
SET @school_admin_name = 'School Admin';
SET @new_school_admin_user_id = '00000000-0000-4000-8000-000000000011';
SET @new_school_admin_profile_id = '00000000-0000-4000-8000-000000000012';
SET @new_school_admin_role_id = '00000000-0000-4000-8000-000000000013';

INSERT INTO schools (
  id,
  name,
  school_type,
  address,
  phone,
  email,
  eiin_number,
  established_year,
  is_active
)
VALUES (
  @new_demo_school_id,
  'Demo School',
  'bangla_medium',
  'Dhaka, Bangladesh',
  '01700000000',
  @demo_school_email,
  @demo_school_eiin,
  2024,
  1
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  school_type = VALUES(school_type),
  address = VALUES(address),
  phone = VALUES(phone),
  email = VALUES(email),
  eiin_number = VALUES(eiin_number),
  established_year = VALUES(established_year),
  is_active = VALUES(is_active);

SELECT id INTO @demo_school_id
FROM schools
WHERE email = @demo_school_email OR eiin_number = @demo_school_eiin
LIMIT 1;

INSERT INTO users (id, email, password_hash, email_verified_at, is_active)
VALUES (@new_super_admin_user_id, @super_admin_email, @super_admin_password_hash, UTC_TIMESTAMP(), 1)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  email_verified_at = UTC_TIMESTAMP(),
  is_active = VALUES(is_active);

SELECT id INTO @super_admin_user_id
FROM users
WHERE email = @super_admin_email
LIMIT 1;

INSERT INTO user_profiles (id, user_id, school_id, role, full_name, is_active, approval_status)
VALUES (@new_super_admin_profile_id, @super_admin_user_id, NULL, 'super_admin', @super_admin_name, 1, 'approved')
ON DUPLICATE KEY UPDATE
  school_id = NULL,
  role = VALUES(role),
  full_name = VALUES(full_name),
  is_active = VALUES(is_active),
  approval_status = VALUES(approval_status);

INSERT INTO user_roles (id, user_id, role)
VALUES (@new_super_admin_role_id, @super_admin_user_id, 'super_admin')
ON DUPLICATE KEY UPDATE
  role = VALUES(role);

INSERT INTO users (id, email, password_hash, email_verified_at, is_active)
VALUES (@new_school_admin_user_id, @school_admin_email, @school_admin_password_hash, UTC_TIMESTAMP(), 1)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  email_verified_at = UTC_TIMESTAMP(),
  is_active = VALUES(is_active);

SELECT id INTO @school_admin_user_id
FROM users
WHERE email = @school_admin_email
LIMIT 1;

INSERT INTO user_profiles (
  id,
  user_id,
  school_id,
  role,
  full_name,
  phone,
  is_active,
  approval_status
)
VALUES (
  @new_school_admin_profile_id,
  @school_admin_user_id,
  @demo_school_id,
  'school_admin',
  @school_admin_name,
  '01700000001',
  1,
  'approved'
)
ON DUPLICATE KEY UPDATE
  school_id = VALUES(school_id),
  role = VALUES(role),
  full_name = VALUES(full_name),
  phone = VALUES(phone),
  is_active = VALUES(is_active),
  approval_status = VALUES(approval_status);

INSERT INTO user_roles (id, user_id, role)
VALUES (@new_school_admin_role_id, @school_admin_user_id, 'school_admin')
ON DUPLICATE KEY UPDATE
  role = VALUES(role);
