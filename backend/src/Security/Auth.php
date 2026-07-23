<?php

declare(strict_types=1);

namespace SchoolXNow\Security;

use SchoolXNow\Core\Database;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;
use SchoolXNow\Core\Monitoring;

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

        Monitoring::setUserRole((string) $user['role']);
        return $user;
    }

    public static function canAccessTable(array $user, string $table, string $operation): bool
    {
        if ($user['role'] === 'super_admin') {
            return $table !== 'audit_logs' || in_array($operation, ['read', 'create'], true);
        }

        $schoolAdminRead = [
            'schools',
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
        $schoolAdminWrite = array_values(array_diff($schoolAdminRead, ['schools', 'audit_logs']));
        if ($user['role'] === 'school_admin') {
            if ($table === 'audit_logs') {
                return in_array($operation, ['read', 'create'], true);
            }
            return in_array($table, $operation === 'read' ? $schoolAdminRead : $schoolAdminWrite, true);
        }

        $teacherRead = [
            'schools', 'user_profiles', 'classes', 'students', 'subjects', 'teachers',
            'attendance', 'exams', 'exam_results', 'timetable', 'teacher_applications',
            'notifications', 'notification_settings', 'feedback_submissions',
        ];
        $teacherWrite = ['attendance', 'exam_results', 'notification_settings', 'feedback_submissions'];
        if ($user['role'] === 'teacher') {
            if ($table === 'audit_logs') {
                return $operation === 'create';
            }
            return in_array($table, $operation === 'read' ? $teacherRead : $teacherWrite, true);
        }

        $selfServiceRead = ['schools', 'user_profiles', 'notifications', 'notification_settings', 'feedback_submissions'];
        $selfServiceWrite = ['notification_settings', 'feedback_submissions'];
        return in_array($user['role'], ['student', 'guardian'], true)
            && in_array($table, $operation === 'read' ? $selfServiceRead : $selfServiceWrite, true);
    }
}
