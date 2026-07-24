import crypto, { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RowDataPacket } from 'mysql2/promise';
import { requireUser } from './auth.js';
import { execute, query, transaction } from './db.js';
import { ApiError, readJsonBody, sendData } from './http.js';
import { enforceRateLimit } from './rate-limit.js';

function requireSchoolAdmin(user: Awaited<ReturnType<typeof requireUser>>) {
  if (!['school_admin', 'super_admin'].includes(user.role) || !user.school_id) {
    throw new ApiError(403, 'School administrator access is required');
  }
  return user.school_id;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 500);
}

async function assertSchoolRecord(
  table: 'academic_years' | 'classes',
  id: string,
  schoolId: string,
  connection?: Parameters<typeof query>[2],
) {
  const rows = await query(`SELECT id FROM ${table} WHERE id = :id AND school_id = :school_id LIMIT 1`, {
    id,
    school_id: schoolId,
  }, connection);
  if (!rows[0]) throw new ApiError(422, `${table === 'academic_years' ? 'Academic year' : 'Class'} is invalid`);
}

async function bulkEnroll(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const schoolId = requireSchoolAdmin(user);
  const body = readJsonBody(req);
  const academicYearId = String(body.academic_year_id || '');
  const classId = String(body.class_id || '');
  const studentIds = stringList(body.student_ids);
  if (!academicYearId || !classId || studentIds.length === 0) {
    throw new ApiError(422, 'academic_year_id, class_id, and student_ids are required');
  }

  const created = await transaction(async (connection) => {
    await assertSchoolRecord('academic_years', academicYearId, schoolId, connection);
    await assertSchoolRecord('classes', classId, schoolId, connection);
    const placeholders = studentIds.map((_, index) => `:student_${index}`).join(', ');
    const params = Object.fromEntries(studentIds.map((id, index) => [`student_${index}`, id]));
    const students = await query<RowDataPacket[]>(
      `SELECT id FROM students WHERE school_id = :school_id AND id IN (${placeholders}) FOR UPDATE`,
      { school_id: schoolId, ...params },
      connection,
    );
    if (students.length !== studentIds.length) throw new ApiError(422, 'One or more students are invalid');

    for (const studentId of studentIds) {
      await execute(
        `INSERT INTO student_enrollments
         (id, school_id, academic_year_id, student_id, class_id, status, enrolled_on)
         VALUES (:id, :school_id, :academic_year_id, :student_id, :class_id, 'active', CURRENT_DATE)`,
        { id: randomUUID(), school_id: schoolId, academic_year_id: academicYearId, student_id: studentId, class_id: classId },
        connection,
      );
    }
    return studentIds.length;
  });

  return sendData(res, { enrolled: created }, 201);
}

async function promote(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const schoolId = requireSchoolAdmin(user);
  const body = readJsonBody(req);
  const sourceYearId = String(body.source_academic_year_id || '');
  const targetYearId = String(body.target_academic_year_id || '');
  const targetClassId = String(body.target_class_id || '');
  const studentIds = stringList(body.student_ids);
  if (!sourceYearId || !targetYearId || !targetClassId || studentIds.length === 0 || sourceYearId === targetYearId) {
    throw new ApiError(422, 'Distinct source/target years, target_class_id, and student_ids are required');
  }

  const promoted = await transaction(async (connection) => {
    await assertSchoolRecord('academic_years', sourceYearId, schoolId, connection);
    await assertSchoolRecord('academic_years', targetYearId, schoolId, connection);
    await assertSchoolRecord('classes', targetClassId, schoolId, connection);
    const placeholders = studentIds.map((_, index) => `:student_${index}`).join(', ');
    const studentParams = Object.fromEntries(studentIds.map((id, index) => [`student_${index}`, id]));
    const current = await query<RowDataPacket[]>(
      `SELECT id, student_id FROM student_enrollments
       WHERE school_id = :school_id AND academic_year_id = :source_year
         AND student_id IN (${placeholders}) AND status = 'active'
       FOR UPDATE`,
      { school_id: schoolId, source_year: sourceYearId, ...studentParams },
      connection,
    );
    if (current.length !== studentIds.length) throw new ApiError(409, 'Every selected student must have an active source enrollment');

    for (const enrollment of current) {
      await execute(
        "UPDATE student_enrollments SET status = 'promoted', ended_on = CURRENT_DATE WHERE id = :id",
        { id: enrollment.id },
        connection,
      );
      await execute(
        `INSERT INTO student_enrollments
         (id, school_id, academic_year_id, student_id, class_id, status, enrolled_on)
         VALUES (:id, :school_id, :academic_year_id, :student_id, :class_id, 'active', CURRENT_DATE)`,
        {
          id: randomUUID(), school_id: schoolId, academic_year_id: targetYearId,
          student_id: enrollment.student_id, class_id: targetClassId,
        },
        connection,
      );
      await execute(
        'UPDATE students SET class_id = :class_id WHERE id = :student_id AND school_id = :school_id',
        { class_id: targetClassId, student_id: enrollment.student_id, school_id: schoolId },
        connection,
      );
    }
    return current.length;
  });

  return sendData(res, { promoted });
}

async function acceptAdmission(req: VercelRequest, res: VercelResponse, applicationId: string) {
  const user = await requireUser(req);
  const schoolId = requireSchoolAdmin(user);
  const body = readJsonBody(req);
  const studentNumber = String(body.student_number || '').trim();
  const classId = String(body.class_id || '').trim();
  if (!studentNumber || !classId) throw new ApiError(422, 'student_number and class_id are required');

  const result = await transaction(async (connection) => {
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM admission_applications
       WHERE id = :id AND school_id = :school_id AND status IN ('submitted', 'under_review', 'waitlisted')
       FOR UPDATE`,
      { id: applicationId, school_id: schoolId },
      connection,
    );
    const application = rows[0];
    if (!application) throw new ApiError(404, 'Eligible admission application not found');
    await assertSchoolRecord('classes', classId, schoolId, connection);
    const studentId = randomUUID();
    await execute(
      `INSERT INTO students
       (id, school_id, class_id, student_id, full_name, father_name, mother_name, date_of_birth,
        gender, address, guardian_phone, guardian_email, admission_date, status)
       VALUES
       (:id, :school_id, :class_id, :student_number, :full_name, 'Not provided', 'Not provided',
        :date_of_birth, :gender, :address, :guardian_phone, :guardian_email, CURRENT_DATE, 'active')`,
      {
        id: studentId, school_id: schoolId, class_id: classId, student_number: studentNumber,
        full_name: application.applicant_name, date_of_birth: application.date_of_birth,
        gender: application.gender === 'other' || application.gender === 'unspecified' ? 'male' : application.gender,
        address: application.address || 'Not provided', guardian_phone: application.guardian_phone,
        guardian_email: application.guardian_email,
      },
      connection,
    );
    const enrollmentId = randomUUID();
    await execute(
      `INSERT INTO student_enrollments
       (id, school_id, academic_year_id, student_id, class_id, status, enrolled_on)
       VALUES (:id, :school_id, :year_id, :student_id, :class_id, 'active', CURRENT_DATE)`,
      {
        id: enrollmentId, school_id: schoolId, year_id: application.academic_year_id,
        student_id: studentId, class_id: classId,
      },
      connection,
    );
    await execute(
      `UPDATE admission_applications
       SET status = 'accepted', student_id = :student_id, decided_by = :user_id,
           decided_at = UTC_TIMESTAMP(), decision_notes = :notes
       WHERE id = :id`,
      { student_id: studentId, user_id: user.id, notes: body.decision_notes || null, id: applicationId },
      connection,
    );
    return { student_id: studentId, enrollment_id: enrollmentId };
  });
  return sendData(res, result, 201);
}

async function inviteGuardian(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  const schoolId = requireSchoolAdmin(user);
  const body = readJsonBody(req);
  const studentId = String(body.student_id || '');
  const email = String(body.email || '').trim().toLowerCase();
  const relationshipType = String(body.relationship_type || '');
  if (!studentId || !email || !relationshipType) throw new ApiError(422, 'student_id, email, and relationship_type are required');
  if (!['father', 'mother', 'legal_guardian', 'grandparent', 'sibling', 'relative', 'other'].includes(relationshipType)) {
    throw new ApiError(422, 'relationship_type is invalid');
  }
  await enforceRateLimit(req, res, { action: 'academic.guardian-invitation', limit: 20, windowSeconds: 3600 }, user.id);
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 19).replace('T', ' ');
  await execute(
    `INSERT INTO guardian_invitations
     (id, school_id, student_id, email, relationship_type, token_hash, invited_by, expires_at)
     SELECT :id, :school_id, s.id, :email, :relationship_type, :token_hash, :invited_by, :expires_at
     FROM students s WHERE s.id = :student_id AND s.school_id = :school_id`,
    {
      id: randomUUID(), school_id: schoolId, student_id: studentId, email, relationship_type: relationshipType,
      token_hash: crypto.createHash('sha256').update(token).digest('hex'), invited_by: user.id, expires_at: expiresAt,
    },
  );
  const frontend = String(process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
  return sendData(res, {
    token,
    invitation_url: frontend ? `${frontend}/guardian-invitation?token=${encodeURIComponent(token)}` : null,
    expires_at: expiresAt,
  }, 201);
}

async function acceptGuardianInvitation(req: VercelRequest, res: VercelResponse) {
  const user = await requireUser(req);
  if (user.role !== 'guardian' || !user.school_id) throw new ApiError(403, 'Guardian account is required');
  const token = String(readJsonBody(req).token || '');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const relationshipId = await transaction(async (connection) => {
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM guardian_invitations
       WHERE token_hash = :token_hash AND status = 'pending' AND expires_at > UTC_TIMESTAMP()
       FOR UPDATE`,
      { token_hash: tokenHash },
      connection,
    );
    const invitation = rows[0];
    if (!invitation || invitation.school_id !== user.school_id || invitation.email !== user.email) {
      throw new ApiError(422, 'Guardian invitation is invalid or expired');
    }
    const id = randomUUID();
    await execute(
      `INSERT INTO guardian_relationships
       (id, school_id, guardian_user_id, student_id, relationship_type, has_portal_access)
       VALUES (:id, :school_id, :guardian_user_id, :student_id, :relationship_type, 1)
       ON DUPLICATE KEY UPDATE relationship_type = VALUES(relationship_type), has_portal_access = 1`,
      {
        id, school_id: user.school_id, guardian_user_id: user.id,
        student_id: invitation.student_id, relationship_type: invitation.relationship_type,
      },
      connection,
    );
    await execute(
      `UPDATE guardian_invitations SET status = 'accepted', accepted_by = :user_id,
       accepted_at = UTC_TIMESTAMP() WHERE id = :id`,
      { user_id: user.id, id: invitation.id },
      connection,
    );
    return id;
  });
  return sendData(res, { relationship_id: relationshipId });
}

export async function handleAcademic(req: VercelRequest, res: VercelResponse, segments: string[]) {
  const action = segments[1];
  if (req.method === 'POST' && action === 'bulk-enroll') return bulkEnroll(req, res);
  if (req.method === 'POST' && action === 'promote') return promote(req, res);
  if (req.method === 'POST' && action === 'guardian-invitations') return inviteGuardian(req, res);
  if (req.method === 'POST' && action === 'accept-guardian-invitation') return acceptGuardianInvitation(req, res);
  if (req.method === 'POST' && action === 'admissions' && segments[2] && segments[3] === 'accept') {
    return acceptAdmission(req, res, segments[2]);
  }
  throw new ApiError(404, 'Academic operation not found');
}
