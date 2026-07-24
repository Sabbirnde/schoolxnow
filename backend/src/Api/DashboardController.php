<?php

declare(strict_types=1);

namespace SchoolXNow\Api;

use PDO;
use SchoolXNow\Core\Database;
use SchoolXNow\Core\Response;
use SchoolXNow\Security\Auth;

final class DashboardController
{
    public function schoolAdmin(): void
    {
        $user = Auth::user();
        $schoolId = trim((string) ($_GET['school_id'] ?? ''));

        if ($schoolId === '') {
            Response::json(['error' => ['message' => 'school_id is required']], 422);
        }
        if ($user['role'] !== 'school_admin' || !$user['school_id'] || $user['school_id'] !== $schoolId) {
            Response::json(['error' => ['message' => 'School administrator access is required']], 403);
        }

        $db = Database::connection();
        $db->beginTransaction();

        try {
            $school = $this->one(
                $db,
                'SELECT id, name, name_bangla, school_type
                 FROM schools
                 WHERE id = ? AND is_active = 1
                 LIMIT 1',
                [$schoolId]
            );
            if (!$school) {
                $db->rollBack();
                Response::json(['error' => ['message' => 'School not found']], 404);
            }

            $stats = $this->one(
                $db,
                "SELECT
                   (SELECT COUNT(*) FROM students WHERE school_id = ?) AS totalStudents,
                   (SELECT COUNT(*) FROM students WHERE school_id = ? AND status = 'active') AS activeStudents,
                   (SELECT COUNT(*) FROM teachers WHERE school_id = ? AND is_active = 1) AS totalTeachers,
                   (SELECT COUNT(*) FROM classes WHERE school_id = ? AND is_active = 1) AS totalClasses,
                   (SELECT COUNT(*) FROM subjects WHERE school_id = ? AND is_active = 1) AS totalSubjects,
                   (SELECT COUNT(*) FROM students
                    WHERE school_id = ? AND admission_date >= UTC_DATE() - INTERVAL 30 DAY) AS recentAdmissions",
                array_fill(0, 6, $schoolId)
            );

            $tasks = $this->one(
                $db,
                "SELECT
                   (SELECT COUNT(*)
                    FROM classes c
                    WHERE c.school_id = ?
                      AND c.is_active = 1
                      AND NOT EXISTS (
                        SELECT 1 FROM attendance a
                        WHERE a.school_id = c.school_id
                          AND a.class_id = c.id
                          AND a.date = UTC_DATE()
                      )) AS pendingAttendance,
                   (SELECT COUNT(*) FROM exams
                    WHERE school_id = ?
                      AND is_active = 1
                      AND exam_date BETWEEN UTC_DATE() AND UTC_DATE() + INTERVAL 7 DAY) AS scheduledExams,
                   (SELECT COUNT(*) FROM students
                    WHERE school_id = ?
                      AND status = 'active'
                      AND admission_date = UTC_DATE()) AS newAdmissions,
                   (SELECT COUNT(*) FROM teacher_applications
                    WHERE school_id = ? AND status = 'pending') AS pendingApplications",
                array_fill(0, 4, $schoolId)
            );

            $recentAdmissions = $this->all(
                $db,
                'SELECT s.id, s.full_name, s.admission_date, s.class_id, c.name AS class_name
                 FROM students s
                 LEFT JOIN classes c ON c.id = s.class_id AND c.school_id = s.school_id
                 WHERE s.school_id = ?
                 ORDER BY s.admission_date DESC, s.created_at DESC
                 LIMIT 5',
                [$schoolId]
            );

            $recentActivity = $this->all(
                $db,
                "SELECT id, action, entity_type, entity_id, timestamp, success,
                        error_message, user_id, metadata
                 FROM audit_logs
                 WHERE school_id = ?
                   AND entity_type IN (
                     'students', 'teachers', 'classes', 'exams',
                     'attendance', 'exam_marks', 'timetable', 'subjects'
                   )
                 ORDER BY timestamp DESC
                 LIMIT 15",
                [$schoolId]
            );

            $db->commit();

            Response::json(['data' => [
                'school' => $school,
                'stats' => $this->integerValues($stats),
                'recentAdmissions' => array_map(static fn (array $student): array => [
                    'id' => $student['id'],
                    'full_name' => $student['full_name'],
                    'admission_date' => $student['admission_date'],
                    'class_id' => $student['class_id'],
                    'classes' => $student['class_name'] ? ['name' => $student['class_name']] : null,
                ], $recentAdmissions),
                'tasks' => $this->integerValues($tasks),
                'recentActivity' => array_map(static function (array $entry): array {
                    $entry['success'] = (bool) $entry['success'];
                    if (is_string($entry['metadata'])) {
                        $entry['metadata'] = json_decode($entry['metadata'], true);
                    }
                    return $entry;
                }, $recentActivity),
            ]]);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    private function one(PDO $db, string $sql, array $params): array|false
    {
        $statement = $db->prepare($sql);
        $statement->execute($params);
        return $statement->fetch();
    }

    private function all(PDO $db, string $sql, array $params): array
    {
        $statement = $db->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll();
    }

    private function integerValues(array $values): array
    {
        return array_map(static fn (mixed $value): int => (int) $value, $values);
    }
}
