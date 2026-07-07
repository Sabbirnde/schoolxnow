-- Replace the UUID, email, password hash, and name before importing.
-- Generate password_hash with PHP:
-- php -r "echo password_hash('YourPassword123', PASSWORD_DEFAULT), PHP_EOL;"

SET @user_id = '00000000-0000-4000-8000-000000000001';
SET @profile_id = '00000000-0000-4000-8000-000000000002';
SET @role_id = '00000000-0000-4000-8000-000000000003';
SET @email = 'admin@example.com';
SET @password_hash = '$2y$10$replace_this_with_real_password_hash';
SET @full_name = 'System Admin';

INSERT INTO users (id, email, password_hash, email_verified_at, is_active)
VALUES (@user_id, @email, @password_hash, UTC_TIMESTAMP(), 1);

INSERT INTO user_profiles (id, user_id, school_id, role, full_name, is_active, approval_status)
VALUES (@profile_id, @user_id, NULL, 'super_admin', @full_name, 1, 'approved');

INSERT INTO user_roles (id, user_id, role)
VALUES (@role_id, @user_id, 'super_admin');
