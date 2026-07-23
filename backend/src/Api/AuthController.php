<?php

declare(strict_types=1);

namespace SchoolXNow\Api;

use SchoolXNow\Core\Database;
use SchoolXNow\Core\Config;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;
use SchoolXNow\Core\Monitoring;
use SchoolXNow\Security\Auth;
use SchoolXNow\Security\RateLimiter;
use SchoolXNow\Security\TokenService;

final class AuthController
{
    public function login(): void
    {
        $body = Request::json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        RateLimiter::enforce('auth.login', $email, 10, 900);

        if ($email === '' || $password === '') {
            Response::json(['error' => ['message' => 'Email and password are required']], 422);
        }

        $stmt = Database::connection()->prepare(
            'SELECT u.id,
                    u.email,
                    u.password_hash,
                    p.school_id,
                    COALESCE(r.role, p.role) AS role,
                    p.full_name,
                    p.full_name_bangla,
                    p.phone,
                    p.avatar_url,
                    p.address,
                    p.address_bangla,
                    p.approval_status,
                    p.is_active
             FROM users u
             JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN user_roles r ON r.user_id = u.id
             WHERE u.email = :email
             LIMIT 1'
        );
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::json(['error' => ['message' => 'Invalid email or password']], 401);
        }

        if ((int) $user['is_active'] !== 1) {
            Response::json(['error' => ['message' => 'Account is inactive']], 403);
        }

        unset($user['password_hash']);
        $token = TokenService::issue([
            'sub' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'school_id' => $user['school_id'],
        ]);

        Response::json([
            'data' => [
                'user' => $user,
                'session' => [
                    'access_token' => $token,
                    'token_type' => 'bearer',
                ],
            ],
        ]);
    }

    public function register(): void
    {
        $body = Request::json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $fullName = trim((string) ($body['full_name'] ?? ''));
        $role = (string) ($body['role'] ?? 'teacher');
        $schoolId = $body['school_id'] ?? null;
        RateLimiter::enforce('auth.register', $email, 5, 3600);

        if ($email === '' || $password === '' || $fullName === '') {
            Response::json(['error' => ['message' => 'Email, password, and full_name are required']], 422);
        }

        if ($role === 'super_admin') {
            Response::json(['error' => ['message' => 'Super admin registration must use bootstrap']], 403);
        }

        if (!in_array($role, ['school_admin', 'teacher'], true)) {
            Response::json(['error' => ['message' => 'Invalid role']], 422);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $id = self::uuid();
            $pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :password_hash)')
                ->execute([
                    'id' => $id,
                    'email' => $email,
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                ]);

            $profileId = self::uuid();
            $pdo->prepare(
                'INSERT INTO user_profiles (id, user_id, school_id, role, full_name, approval_status)
                 VALUES (:id, :user_id, :school_id, :role, :full_name, :approval_status)'
            )->execute([
                'id' => $profileId,
                'user_id' => $id,
                'school_id' => $schoolId,
                'role' => $role,
                'full_name' => $fullName,
                'approval_status' => $role === 'super_admin' ? 'approved' : 'pending',
            ]);

            $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, :role)')
                ->execute([
                    'id' => self::uuid(),
                    'user_id' => $id,
                    'role' => $role,
                ]);

            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            Monitoring::logError($error, 'auth_registration_error');
            Response::json(['error' => ['message' => 'Registration failed', 'detail' => Config::get('APP_DEBUG') === 'true' ? $error->getMessage() : null]], 400);
        }

        Response::json(['data' => ['id' => $id, 'email' => $email]], 201);
    }

    public function registerSchool(): void
    {
        $body = Request::json();
        $school = $body['school'] ?? [];
        $admin = $body['admin'] ?? [];

        if (!is_array($school) || !is_array($admin)) {
            Response::json(['error' => ['message' => 'School and admin data are required']], 422);
        }

        $schoolName = trim((string) ($school['name'] ?? ''));
        $schoolType = (string) ($school['school_type'] ?? '');
        $schoolAddress = trim((string) ($school['address'] ?? ''));
        $schoolPhone = trim((string) ($school['phone'] ?? ''));
        $schoolEmail = strtolower(trim((string) ($school['email'] ?? '')));
        $adminName = trim((string) ($admin['full_name'] ?? ''));
        $adminEmail = strtolower(trim((string) ($admin['email'] ?? '')));
        $adminPhone = trim((string) ($admin['phone'] ?? ''));
        $adminPassword = (string) ($admin['password'] ?? '');
        RateLimiter::enforce('auth.register-school', $adminEmail, 3, 3600);

        if ($schoolName === '' || $schoolAddress === '' || $schoolPhone === '' || $schoolEmail === '') {
            Response::json(['error' => ['message' => 'School name, address, phone, and email are required']], 422);
        }

        if (!in_array($schoolType, ['bangla_medium', 'english_medium', 'madrasha'], true)) {
            Response::json(['error' => ['message' => 'Invalid school type']], 422);
        }

        if (!filter_var($schoolEmail, FILTER_VALIDATE_EMAIL) || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
            Response::json(['error' => ['message' => 'A valid school email and admin email are required']], 422);
        }

        if ($adminName === '' || $adminPhone === '' || strlen($adminPassword) < 6) {
            Response::json(['error' => ['message' => 'Admin name, phone, and a password of at least 6 characters are required']], 422);
        }

        $eiinNumber = self::nullableString($school['eiin_number'] ?? null);
        $establishedYear = $school['established_year'] ?? null;
        $schoolId = self::uuid();
        $adminUserId = self::uuid();
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'INSERT INTO schools
                 (id, name, name_bangla, school_type, address, address_bangla, phone, email, eiin_number, established_year, is_active)
                 VALUES
                 (:id, :name, :name_bangla, :school_type, :address, :address_bangla, :phone, :email, :eiin_number, :established_year, 1)'
            )->execute([
                'id' => $schoolId,
                'name' => $schoolName,
                'name_bangla' => self::nullableString($school['name_bangla'] ?? null),
                'school_type' => $schoolType,
                'address' => $schoolAddress,
                'address_bangla' => self::nullableString($school['address_bangla'] ?? null),
                'phone' => $schoolPhone,
                'email' => $schoolEmail,
                'eiin_number' => $eiinNumber,
                'established_year' => $establishedYear === null || $establishedYear === '' ? null : (int) $establishedYear,
            ]);

            $pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (:id, :email, :password_hash)')
                ->execute([
                    'id' => $adminUserId,
                    'email' => $adminEmail,
                    'password_hash' => password_hash($adminPassword, PASSWORD_DEFAULT),
                ]);

            $pdo->prepare(
                'INSERT INTO user_profiles
                 (id, user_id, school_id, role, full_name, phone, approval_status, is_active)
                 VALUES
                 (:id, :user_id, :school_id, \'school_admin\', :full_name, :phone, \'pending\', 1)'
            )->execute([
                'id' => self::uuid(),
                'user_id' => $adminUserId,
                'school_id' => $schoolId,
                'full_name' => $adminName,
                'phone' => $adminPhone,
            ]);

            $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, \'school_admin\')')
                ->execute([
                    'id' => self::uuid(),
                    'user_id' => $adminUserId,
                ]);

            self::logAuditEvent($pdo, [
                'user_id' => $adminUserId,
                'school_id' => $schoolId,
                'action' => 'SCHOOL_REGISTRATION_CREATED',
                'entity_type' => 'schools',
                'entity_id' => $schoolId,
                'metadata' => ['school_name' => $schoolName, 'admin_email' => $adminEmail],
            ]);

            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            Monitoring::logError($error, 'school_registration_error');
            $message = $error->getMessage();
            if (str_contains($message, 'users.email') || str_contains($message, 'users_email') || str_contains($message, 'Duplicate')) {
                Response::json(['error' => ['message' => 'This email or EIIN number is already registered']], 409);
            }

            Response::json(['error' => ['message' => 'School registration failed', 'detail' => Config::get('APP_DEBUG') === 'true' ? $message : null]], 400);
        }

        Response::json([
            'data' => [
                'school' => ['id' => $schoolId, 'name' => $schoolName],
                'admin' => ['id' => $adminUserId, 'email' => $adminEmail],
            ],
        ], 201);
    }

    public function bootstrapStatus(): void
    {
        Response::json(['data' => ['super_admin_exists' => self::superAdminExists()]]);
    }

    public function createSuperAdmin(): void
    {
        $body = Request::json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $fullName = trim((string) ($body['full_name'] ?? $body['fullName'] ?? ''));
        $secretKey = (string) ($body['secret_key'] ?? $body['secretKey'] ?? '');
        RateLimiter::enforce('bootstrap.create-super-admin', $email, 5, 3600);
        $configuredSecret = Config::required('SUPER_ADMIN_SECRET');

        if ($secretKey === '' || !hash_equals($configuredSecret, $secretKey)) {
            Response::json(['error' => ['message' => 'Invalid bootstrap secret key']], 401);
        }

        if (self::superAdminExists()) {
            Response::json(['error' => ['message' => 'Bootstrap already completed. A super administrator already exists.']], 409);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $fullName === '' || strlen($password) < 8) {
            Response::json(['error' => ['message' => 'Valid email, full name, and password of at least 8 characters are required']], 422);
        }

        $userId = self::uuid();
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'INSERT INTO users (id, email, password_hash, email_verified_at, is_active)
                 VALUES (:id, :email, :password_hash, CURRENT_TIMESTAMP, 1)'
            )->execute([
                'id' => $userId,
                'email' => $email,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ]);

            $pdo->prepare(
                'INSERT INTO user_profiles
                 (id, user_id, school_id, role, full_name, approval_status, is_active)
                 VALUES (:id, :user_id, NULL, \'super_admin\', :full_name, \'approved\', 1)'
            )->execute([
                'id' => self::uuid(),
                'user_id' => $userId,
                'full_name' => $fullName,
            ]);

            $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, \'super_admin\')')
                ->execute([
                    'id' => self::uuid(),
                    'user_id' => $userId,
                ]);

            self::logAuditEvent($pdo, [
                'user_id' => $userId,
                'school_id' => null,
                'action' => 'BOOTSTRAP_COMPLETED',
                'entity_type' => 'bootstrap',
                'entity_id' => $userId,
                'metadata' => ['email' => $email, 'full_name' => $fullName],
            ]);

            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            Monitoring::logError($error, 'bootstrap_error');
            Response::json(['error' => ['message' => 'Failed to create super admin', 'detail' => Config::get('APP_DEBUG') === 'true' ? $error->getMessage() : null]], 400);
        }

        Response::json([
            'data' => [
                'success' => true,
                'message' => 'Super admin created successfully',
                'user_id' => $userId,
            ],
        ], 201);
    }

    public function me(): void
    {
        Response::json(['data' => Auth::user()]);
    }

    public function publicSchools(): void
    {
        $stmt = Database::connection()->query(
            'SELECT id, name, name_bangla, school_type
             FROM schools
             WHERE is_active = 1
             ORDER BY name ASC
             LIMIT 500'
        );

        Response::json(['data' => $stmt->fetchAll()]);
    }

    public function submitTeacherApplication(): void
    {
        $user = Auth::user();
        if ($user['role'] !== 'teacher') {
            Response::json(['error' => ['message' => 'Only teacher accounts can submit teacher applications']], 403);
        }

        $body = Request::json();
        $schoolId = trim((string) ($body['school_id'] ?? ''));
        $fullName = trim((string) ($body['full_name'] ?? ''));
        $phone = trim((string) ($body['phone'] ?? ''));

        if ($schoolId === '' || $fullName === '' || $phone === '') {
            Response::json(['error' => ['message' => 'School, full name, and phone are required']], 422);
        }

        $schoolStmt = Database::connection()->prepare('SELECT id FROM schools WHERE id = :id AND is_active = 1 LIMIT 1');
        $schoolStmt->execute(['id' => $schoolId]);
        if (!$schoolStmt->fetch()) {
            Response::json(['error' => ['message' => 'Selected school was not found']], 404);
        }

        $applicationId = self::uuid();
        Database::connection()->prepare(
            'INSERT INTO teacher_applications
             (id, user_id, school_id, full_name, full_name_bangla, phone, address, address_bangla, qualification, subject_specialization, experience_years, status)
             VALUES
             (:id, :user_id, :school_id, :full_name, :full_name_bangla, :phone, :address, :address_bangla, :qualification, :subject_specialization, :experience_years, \'pending\')'
        )->execute([
            'id' => $applicationId,
            'user_id' => $user['id'],
            'school_id' => $schoolId,
            'full_name' => $fullName,
            'full_name_bangla' => self::nullableString($body['full_name_bangla'] ?? null),
            'phone' => $phone,
            'address' => self::nullableString($body['address'] ?? null),
            'address_bangla' => self::nullableString($body['address_bangla'] ?? null),
            'qualification' => self::nullableString($body['qualification'] ?? null),
            'subject_specialization' => self::nullableString($body['subject_specialization'] ?? null),
            'experience_years' => (int) ($body['experience_years'] ?? 0),
        ]);

        Response::json(['data' => ['id' => $applicationId]], 201);
    }

    public function updateProfile(): void
    {
        $user = Auth::user();
        $body = Request::json();

        $fullName = trim((string) ($body['full_name'] ?? ''));
        if ($fullName === '') {
            Response::json(['error' => ['message' => 'Full name is required']], 422);
        }

        $fields = [
            'full_name' => $fullName,
            'full_name_bangla' => self::nullableString($body['full_name_bangla'] ?? null),
            'phone' => self::nullableString($body['phone'] ?? null),
            'avatar_url' => self::nullableString($body['avatar_url'] ?? null),
            'address' => self::nullableString($body['address'] ?? null),
            'address_bangla' => self::nullableString($body['address_bangla'] ?? null),
        ];

        Database::connection()->prepare(
            'UPDATE user_profiles
             SET full_name = :full_name,
                 full_name_bangla = :full_name_bangla,
                 phone = :phone,
                 avatar_url = :avatar_url,
                 address = :address,
                 address_bangla = :address_bangla
             WHERE user_id = :user_id'
        )->execute([
            ...$fields,
            'user_id' => $user['id'],
        ]);

        Response::json(['data' => self::profileForUser($user['id'])]);
    }

    public function changePassword(): void
    {
        $user = Auth::user();
        $body = Request::json();
        $currentPassword = (string) ($body['current_password'] ?? '');
        $newPassword = (string) ($body['new_password'] ?? '');

        if ($currentPassword === '' || $newPassword === '') {
            Response::json(['error' => ['message' => 'Current password and new password are required']], 422);
        }

        if (strlen($newPassword) < 6) {
            Response::json(['error' => ['message' => 'Password must be at least 6 characters long']], 422);
        }

        $stmt = Database::connection()->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $user['id']]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
            Response::json(['error' => ['message' => 'Current password is incorrect']], 422);
        }

        Database::connection()->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id')
            ->execute([
                'id' => $user['id'],
                'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            ]);

        Response::json(['data' => ['ok' => true]]);
    }

    public function requestPasswordReset(): void
    {
        $body = Request::json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $redirectTo = trim((string) ($body['redirect_to'] ?? ''));
        RateLimiter::enforce('auth.request-password-reset', $email, 5, 3600);

        if ($email === '') {
            Response::json(['error' => ['message' => 'Email is required']], 422);
        }

        $stmt = Database::connection()->prepare('SELECT id, email FROM users WHERE email = :email AND is_active = 1 LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        $data = ['ok' => true];

        if ($user) {
            $token = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $token);
            $expiresAt = gmdate('Y-m-d H:i:s', time() + 3600);

            $pdo = Database::connection();
            $pdo->beginTransaction();

            try {
                $pdo->prepare(
                    'UPDATE password_reset_tokens
                     SET used_at = CURRENT_TIMESTAMP
                     WHERE user_id = :user_id AND used_at IS NULL'
                )->execute(['user_id' => $user['id']]);

                $pdo->prepare(
                    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
                     VALUES (:id, :user_id, :token_hash, :expires_at)'
                )->execute([
                    'id' => self::uuid(),
                    'user_id' => $user['id'],
                    'token_hash' => $tokenHash,
                    'expires_at' => $expiresAt,
                ]);

                $pdo->commit();
            } catch (\Throwable $error) {
                $pdo->rollBack();
                Monitoring::logError($error, 'password_reset_request_error');
                Response::json(['error' => ['message' => 'Password reset request failed', 'detail' => Config::get('APP_DEBUG') === 'true' ? $error->getMessage() : null]], 400);
            }

            $data['reset_token'] = $token;
            if ($redirectTo !== '') {
                $data['reset_url'] = self::appendQuery($redirectTo, ['token' => $token]);
            }
        }

        Response::json(['data' => $data]);
    }

    public function resetPassword(): void
    {
        $body = Request::json();
        $token = trim((string) ($body['token'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($token === '' || $password === '') {
            Response::json(['error' => ['message' => 'Reset token and password are required']], 422);
        }

        if (strlen($password) < 6) {
            Response::json(['error' => ['message' => 'Password must be at least 6 characters long']], 422);
        }

        $tokenHash = hash('sha256', $token);
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare(
                'SELECT id, user_id
                 FROM password_reset_tokens
                 WHERE token_hash = :token_hash
                   AND used_at IS NULL
                   AND expires_at > UTC_TIMESTAMP()
                 LIMIT 1'
            );
            $stmt->execute(['token_hash' => $tokenHash]);
            $reset = $stmt->fetch();

            if (!$reset) {
                $pdo->rollBack();
                Response::json(['error' => ['message' => 'Password reset link is invalid or expired']], 422);
            }

            $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id')
                ->execute([
                    'id' => $reset['user_id'],
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                ]);

            $pdo->prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = :id')
                ->execute(['id' => $reset['id']]);

            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            Monitoring::logError($error, 'password_reset_error');
            Response::json(['error' => ['message' => 'Password reset failed', 'detail' => Config::get('APP_DEBUG') === 'true' ? $error->getMessage() : null]], 400);
        }

        Response::json(['data' => ['ok' => true]]);
    }

    public function createTeacherPortalLink(): void
    {
        $actor = Auth::user();
        if (!in_array($actor['role'], ['super_admin', 'school_admin'], true)) {
            Response::json(['error' => ['message' => 'Forbidden']], 403);
        }

        $body = Request::json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $redirectTo = trim((string) ($body['redirect_to'] ?? ''));
        $expiresIn = min(max((int) ($body['expires_in'] ?? 86400), 300), 604800);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::json(['error' => ['message' => 'A valid teacher email is required']], 422);
        }

        $stmt = Database::connection()->prepare(
            'SELECT u.id, u.email, p.school_id, COALESCE(r.role, p.role) AS role
             FROM users u
             JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN user_roles r ON r.user_id = u.id
             WHERE u.email = :email AND p.is_active = 1
             LIMIT 1'
        );
        $stmt->execute(['email' => $email]);
        $teacher = $stmt->fetch();

        if (!$teacher || $teacher['role'] !== 'teacher') {
            Response::json(['error' => ['message' => 'Teacher account not found']], 404);
        }

        if ($actor['role'] === 'school_admin' && $actor['school_id'] !== $teacher['school_id']) {
            Response::json(['error' => ['message' => 'Forbidden']], 403);
        }

        $token = bin2hex(random_bytes(32));
        $expiresAt = gmdate('Y-m-d H:i:s', time() + $expiresIn);
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'UPDATE teacher_portal_tokens
                 SET used_at = CURRENT_TIMESTAMP
                 WHERE user_id = :user_id AND used_at IS NULL'
            )->execute(['user_id' => $teacher['id']]);

            $pdo->prepare(
                'INSERT INTO teacher_portal_tokens (id, user_id, token_hash, expires_at)
                 VALUES (:id, :user_id, :token_hash, :expires_at)'
            )->execute([
                'id' => self::uuid(),
                'user_id' => $teacher['id'],
                'token_hash' => hash('sha256', $token),
                'expires_at' => $expiresAt,
            ]);

            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            Monitoring::logError($error, 'teacher_portal_link_error');
            Response::json(['error' => ['message' => 'Teacher portal link generation failed', 'detail' => Config::get('APP_DEBUG') === 'true' ? $error->getMessage() : null]], 400);
        }

        $base = $redirectTo !== '' ? $redirectTo : self::frontendUrl('/teacher-portal');
        Response::json([
            'data' => [
                'portal_url' => self::appendQuery($base, ['token' => $token]),
                'plain_url' => $base,
                'expires_at' => gmdate('c', strtotime($expiresAt) ?: time()),
            ],
        ]);
    }

    public function loginWithTeacherPortalToken(): void
    {
        $body = Request::json();
        $token = trim((string) ($body['token'] ?? ''));
        RateLimiter::enforce('auth.teacher-portal-login', '', 10, 900);
        if ($token === '') {
            Response::json(['error' => ['message' => 'Teacher portal token is required']], 422);
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare(
                'SELECT t.id AS token_id,
                        u.id,
                        u.email,
                        p.school_id,
                        COALESCE(r.role, p.role) AS role,
                        p.full_name,
                        p.full_name_bangla,
                        p.phone,
                        p.avatar_url,
                        p.address,
                        p.address_bangla,
                        p.approval_status,
                        p.is_active
                 FROM teacher_portal_tokens t
                 JOIN users u ON u.id = t.user_id
                 JOIN user_profiles p ON p.user_id = u.id
                 LEFT JOIN user_roles r ON r.user_id = u.id
                 WHERE t.token_hash = :token_hash
                   AND t.used_at IS NULL
                   AND t.expires_at > UTC_TIMESTAMP()
                 LIMIT 1'
            );
            $stmt->execute(['token_hash' => hash('sha256', $token)]);
            $user = $stmt->fetch();

            if (!$user || $user['role'] !== 'teacher' || (int) $user['is_active'] !== 1) {
                $pdo->rollBack();
                Response::json(['error' => ['message' => 'Teacher portal link is invalid or expired']], 422);
            }

            $pdo->prepare('UPDATE teacher_portal_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = :id')
                ->execute(['id' => $user['token_id']]);
            unset($user['token_id']);

            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            Monitoring::logError($error, 'teacher_portal_login_error');
            Response::json(['error' => ['message' => 'Teacher portal login failed', 'detail' => Config::get('APP_DEBUG') === 'true' ? $error->getMessage() : null]], 400);
        }

        $jwt = TokenService::issue([
            'sub' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'school_id' => $user['school_id'],
        ]);

        Response::json([
            'data' => [
                'user' => $user,
                'session' => [
                    'access_token' => $jwt,
                    'token_type' => 'bearer',
                ],
            ],
        ]);
    }

    public function logout(): void
    {
        Response::json(['data' => ['ok' => true]]);
    }

    private static function profileForUser(string $userId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT p.id,
                    p.user_id,
                    p.school_id,
                    COALESCE(r.role, p.role) AS role,
                    p.full_name,
                    p.full_name_bangla,
                    p.phone,
                    p.avatar_url,
                    p.address,
                    p.address_bangla,
                    p.is_active
             FROM user_profiles p
             LEFT JOIN user_roles r ON r.user_id = p.user_id
             WHERE p.user_id = :user_id
             LIMIT 1'
        );
        $stmt->execute(['user_id' => $userId]);
        $profile = $stmt->fetch();

        if (!$profile) {
            Response::json(['error' => ['message' => 'Profile not found']], 404);
        }

        return $profile;
    }

    private static function superAdminExists(): bool
    {
        $stmt = Database::connection()->query(
            'SELECT 1
             FROM user_roles r
             JOIN user_profiles p ON p.user_id = r.user_id
             WHERE r.role = \'super_admin\' AND p.is_active = 1
             LIMIT 1'
        );

        return (bool) $stmt->fetchColumn();
    }

    /**
     * @param array{user_id: string|null, school_id: string|null, action: string, entity_type: string, entity_id: string|null, metadata?: array<string, mixed>} $event
     */
    private static function logAuditEvent(\PDO $pdo, array $event): void
    {
        $pdo->prepare(
            'INSERT INTO audit_logs
             (id, user_id, school_id, action, entity_type, entity_id, metadata, success)
             VALUES
             (:id, :user_id, :school_id, :action, :entity_type, :entity_id, :metadata, 1)'
        )->execute([
            'id' => self::uuid(),
            'user_id' => $event['user_id'],
            'school_id' => $event['school_id'],
            'action' => $event['action'],
            'entity_type' => $event['entity_type'],
            'entity_id' => $event['entity_id'],
            'metadata' => json_encode($event['metadata'] ?? [], JSON_UNESCAPED_SLASHES),
        ]);
    }

    private static function nullableString(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        return $text === '' ? null : $text;
    }

    /**
     * @param array<string, string> $params
     */
    private static function appendQuery(string $url, array $params): string
    {
        $separator = str_contains($url, '?') ? '&' : '?';
        return $url . $separator . http_build_query($params);
    }

    private static function frontendUrl(string $path): string
    {
        $origin = Config::get('FRONTEND_URL', Config::get('CORS_ORIGIN', ''));
        return rtrim((string) $origin, '/') . $path;
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
