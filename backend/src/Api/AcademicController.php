<?php

declare(strict_types=1);

namespace SchoolXNow\Api;

use PDO;
use SchoolXNow\Core\Database;
use SchoolXNow\Core\Config;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;
use SchoolXNow\Security\Auth;
use SchoolXNow\Security\RateLimiter;

final class AcademicController
{
    public function bulkEnroll(): void
    {
        [$user, $schoolId] = $this->admin();
        $body = Request::json();
        $studentIds = $this->ids($body['student_ids'] ?? []);
        $yearId = trim((string) ($body['academic_year_id'] ?? ''));
        $classId = trim((string) ($body['class_id'] ?? ''));
        if (!$studentIds || $yearId === '' || $classId === '') {
            Response::json(['error' => ['message' => 'academic_year_id, class_id, and student_ids are required']], 422);
        }

        $db = Database::connection();
        $db->beginTransaction();
        try {
            $this->assertSchoolRecord($db, 'academic_years', $yearId, $schoolId);
            $this->assertSchoolRecord($db, 'classes', $classId, $schoolId);
            $found = $this->schoolStudentIds($db, $studentIds, $schoolId);
            if (count($found) !== count($studentIds)) {
                Response::json(['error' => ['message' => 'One or more students are invalid']], 422);
            }
            $stmt = $db->prepare(
                "INSERT INTO student_enrollments
                 (id, school_id, academic_year_id, student_id, class_id, status, enrolled_on)
                 VALUES (:id, :school_id, :year_id, :student_id, :class_id, 'active', CURRENT_DATE)"
            );
            foreach ($studentIds as $studentId) {
                $stmt->execute([
                    'id' => self::uuid(), 'school_id' => $schoolId, 'year_id' => $yearId,
                    'student_id' => $studentId, 'class_id' => $classId,
                ]);
            }
            $db->commit();
            Response::json(['data' => ['enrolled' => count($studentIds)]], 201);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    public function promote(): void
    {
        [, $schoolId] = $this->admin();
        $body = Request::json();
        $studentIds = $this->ids($body['student_ids'] ?? []);
        $sourceYear = trim((string) ($body['source_academic_year_id'] ?? ''));
        $targetYear = trim((string) ($body['target_academic_year_id'] ?? ''));
        $targetClass = trim((string) ($body['target_class_id'] ?? ''));
        if (!$studentIds || !$sourceYear || !$targetYear || !$targetClass || $sourceYear === $targetYear) {
            Response::json(['error' => ['message' => 'Distinct source/target years, target_class_id, and student_ids are required']], 422);
        }

        $db = Database::connection();
        $db->beginTransaction();
        try {
            $this->assertSchoolRecord($db, 'academic_years', $sourceYear, $schoolId);
            $this->assertSchoolRecord($db, 'academic_years', $targetYear, $schoolId);
            $this->assertSchoolRecord($db, 'classes', $targetClass, $schoolId);
            $placeholders = implode(', ', array_fill(0, count($studentIds), '?'));
            $stmt = $db->prepare(
                "SELECT id, student_id FROM student_enrollments
                 WHERE school_id = ? AND academic_year_id = ? AND student_id IN ({$placeholders})
                   AND status = 'active' FOR UPDATE"
            );
            $stmt->execute([$schoolId, $sourceYear, ...$studentIds]);
            $rows = $stmt->fetchAll();
            if (count($rows) !== count($studentIds)) {
                Response::json(['error' => ['message' => 'Every selected student must have an active source enrollment']], 409);
            }
            foreach ($rows as $row) {
                $db->prepare("UPDATE student_enrollments SET status = 'promoted', ended_on = CURRENT_DATE WHERE id = ?")
                    ->execute([$row['id']]);
                $db->prepare(
                    "INSERT INTO student_enrollments
                     (id, school_id, academic_year_id, student_id, class_id, status, enrolled_on)
                     VALUES (?, ?, ?, ?, ?, 'active', CURRENT_DATE)"
                )->execute([self::uuid(), $schoolId, $targetYear, $row['student_id'], $targetClass]);
                $db->prepare('UPDATE students SET class_id = ? WHERE id = ? AND school_id = ?')
                    ->execute([$targetClass, $row['student_id'], $schoolId]);
            }
            $db->commit();
            Response::json(['data' => ['promoted' => count($rows)]]);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    public function acceptAdmission(string $id): void
    {
        [$user, $schoolId] = $this->admin();
        $body = Request::json();
        $number = trim((string) ($body['student_number'] ?? ''));
        $classId = trim((string) ($body['class_id'] ?? ''));
        if (!$number || !$classId) {
            Response::json(['error' => ['message' => 'student_number and class_id are required']], 422);
        }
        $db = Database::connection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                "SELECT * FROM admission_applications WHERE id = ? AND school_id = ?
                 AND status IN ('submitted','under_review','waitlisted') FOR UPDATE"
            );
            $stmt->execute([$id, $schoolId]);
            $application = $stmt->fetch();
            if (!$application) {
                Response::json(['error' => ['message' => 'Eligible admission application not found']], 404);
            }
            $this->assertSchoolRecord($db, 'classes', $classId, $schoolId);
            $studentId = self::uuid();
            $db->prepare(
                "INSERT INTO students
                 (id, school_id, class_id, student_id, full_name, father_name, mother_name, date_of_birth,
                  gender, address, guardian_phone, guardian_email, admission_date, status)
                 VALUES (?, ?, ?, ?, ?, 'Not provided', 'Not provided', ?, ?, ?, ?, ?, CURRENT_DATE, 'active')"
            )->execute([
                $studentId, $schoolId, $classId, $number, $application['applicant_name'],
                $application['date_of_birth'], $application['gender'] === 'female' ? 'female' : 'male',
                $application['address'] ?: 'Not provided', $application['guardian_phone'], $application['guardian_email'],
            ]);
            $enrollmentId = self::uuid();
            $db->prepare(
                "INSERT INTO student_enrollments
                 (id, school_id, academic_year_id, student_id, class_id, status, enrolled_on)
                 VALUES (?, ?, ?, ?, ?, 'active', CURRENT_DATE)"
            )->execute([$enrollmentId, $schoolId, $application['academic_year_id'], $studentId, $classId]);
            $db->prepare(
                "UPDATE admission_applications SET status = 'accepted', student_id = ?, decided_by = ?,
                 decided_at = UTC_TIMESTAMP(), decision_notes = ? WHERE id = ?"
            )->execute([$studentId, $user['id'], $body['decision_notes'] ?? null, $id]);
            $db->commit();
            Response::json(['data' => ['student_id' => $studentId, 'enrollment_id' => $enrollmentId]], 201);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    public function inviteGuardian(): void
    {
        [$user, $schoolId] = $this->admin();
        $body = Request::json();
        $studentId = trim((string) ($body['student_id'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $relationship = trim((string) ($body['relationship_type'] ?? ''));
        if (!$studentId || !$email || !$relationship) {
            Response::json(['error' => ['message' => 'student_id, email, and relationship_type are required']], 422);
        }
        if (!in_array($relationship, ['father', 'mother', 'legal_guardian', 'grandparent', 'sibling', 'relative', 'other'], true)) {
            Response::json(['error' => ['message' => 'relationship_type is invalid']], 422);
        }
        RateLimiter::enforce('academic.guardian-invitation', (string) $user['id'], 20, 3600);
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $expires = gmdate('Y-m-d H:i:s', time() + 7 * 86400);
        $stmt = Database::connection()->prepare(
            "INSERT INTO guardian_invitations
             (id, school_id, student_id, email, relationship_type, token_hash, invited_by, expires_at)
             SELECT :id, :school_id, s.id, :email, :relationship, :token_hash, :invited_by, :expires
             FROM students s WHERE s.id = :student_id AND s.school_id = :school_id"
        );
        $stmt->execute([
            'id' => self::uuid(), 'school_id' => $schoolId, 'student_id' => $studentId,
            'email' => $email, 'relationship' => $relationship, 'token_hash' => hash('sha256', $token),
            'invited_by' => $user['id'], 'expires' => $expires,
        ]);
        if ($stmt->rowCount() !== 1) {
            Response::json(['error' => ['message' => 'Student not found']], 404);
        }
        $frontend = rtrim((string) Config::get('FRONTEND_URL', Config::get('CORS_ORIGIN', '')), '/');
        Response::json(['data' => [
            'token' => $token,
            'invitation_url' => $frontend !== '' ? $frontend . '/guardian-invitation?token=' . rawurlencode($token) : null,
            'expires_at' => $expires,
        ]], 201);
    }

    public function acceptGuardianInvitation(): void
    {
        $user = Auth::user();
        if ($user['role'] !== 'guardian' || !$user['school_id']) {
            Response::json(['error' => ['message' => 'Guardian account is required']], 403);
        }
        $token = (string) (Request::json()['token'] ?? '');
        $db = Database::connection();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                "SELECT * FROM guardian_invitations WHERE token_hash = ? AND status = 'pending'
                 AND expires_at > UTC_TIMESTAMP() FOR UPDATE"
            );
            $stmt->execute([hash('sha256', $token)]);
            $invitation = $stmt->fetch();
            if (!$invitation || $invitation['school_id'] !== $user['school_id'] || $invitation['email'] !== $user['email']) {
                Response::json(['error' => ['message' => 'Guardian invitation is invalid or expired']], 422);
            }
            $relationshipId = self::uuid();
            $db->prepare(
                "INSERT INTO guardian_relationships
                 (id, school_id, guardian_user_id, student_id, relationship_type, has_portal_access)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE relationship_type = VALUES(relationship_type), has_portal_access = 1"
            )->execute([$relationshipId, $user['school_id'], $user['id'], $invitation['student_id'], $invitation['relationship_type']]);
            $db->prepare(
                "UPDATE guardian_invitations SET status = 'accepted', accepted_by = ?,
                 accepted_at = UTC_TIMESTAMP() WHERE id = ?"
            )->execute([$user['id'], $invitation['id']]);
            $db->commit();
            Response::json(['data' => ['relationship_id' => $relationshipId]]);
        } catch (\Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $error;
        }
    }

    private function admin(): array
    {
        $user = Auth::user();
        if (!in_array($user['role'], ['school_admin', 'super_admin'], true) || !$user['school_id']) {
            Response::json(['error' => ['message' => 'School administrator access is required']], 403);
        }
        return [$user, (string) $user['school_id']];
    }

    private function assertSchoolRecord(PDO $db, string $table, string $id, string $schoolId): void
    {
        $stmt = $db->prepare("SELECT id FROM {$table} WHERE id = ? AND school_id = ? LIMIT 1");
        $stmt->execute([$id, $schoolId]);
        if (!$stmt->fetch()) {
            Response::json(['error' => ['message' => ($table === 'classes' ? 'Class' : 'Academic year') . ' is invalid']], 422);
        }
    }

    private function schoolStudentIds(PDO $db, array $ids, string $schoolId): array
    {
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("SELECT id FROM students WHERE school_id = ? AND id IN ({$placeholders}) FOR UPDATE");
        $stmt->execute([$schoolId, ...$ids]);
        return array_column($stmt->fetchAll(), 'id');
    }

    private function ids(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        return array_slice(array_values(array_unique(array_filter(array_map(
            fn ($id): string => trim((string) $id),
            $value
        )))), 0, 500);
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
