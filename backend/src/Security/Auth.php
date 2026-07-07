<?php

declare(strict_types=1);

namespace SchoolXNow\Security;

use SchoolXNow\Core\Database;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;

final class Auth
{
    public static function user(): array
    {
        $claims = TokenService::verify(Request::bearerToken());
        if ($claims === null || empty($claims['sub'])) {
            Response::json(['error' => ['message' => 'Unauthenticated']], 401);
        }

        $stmt = Database::connection()->prepare(
            'SELECT u.id,
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
             FROM users u
             JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN user_roles r ON r.user_id = u.id
             WHERE u.id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $claims['sub']]);
        $user = $stmt->fetch();

        if (!$user || (int) $user['is_active'] !== 1) {
            Response::json(['error' => ['message' => 'Account is inactive or missing']], 403);
        }

        return $user;
    }

    public static function canManage(array $user, string $table): bool
    {
        if ($user['role'] === 'super_admin') {
            return true;
        }

        $schoolAdminTables = [
            'user_profiles',
            'classes',
            'students',
            'subjects',
            'teachers',
            'attendance',
            'exams',
            'exam_results',
            'timetable',
            'teacher_applications',
            'audit_logs',
            'notifications',
            'notification_settings',
            'feedback_submissions',
        ];

        if ($user['role'] === 'school_admin' && in_array($table, $schoolAdminTables, true)) {
            return true;
        }

        $teacherWritableTables = ['attendance', 'exam_results', 'audit_logs', 'notification_settings', 'feedback_submissions'];
        if ($user['role'] === 'teacher' && in_array($table, $teacherWritableTables, true)) {
            return true;
        }

        $selfServiceTables = ['notification_settings', 'feedback_submissions'];
        return in_array($user['role'], ['student', 'guardian'], true) && in_array($table, $selfServiceTables, true);
    }
}
