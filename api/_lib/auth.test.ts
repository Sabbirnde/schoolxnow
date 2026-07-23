import { describe, expect, it } from 'vitest';
import { canAccessTable, type ApiUser, type TableOperation } from './auth';

function user(role: ApiUser['role']): ApiUser {
  return {
    id: `${role}-id`,
    email: `${role}@example.test`,
    school_id: role === 'super_admin' ? null : 'school-id',
    role,
    full_name: role,
    is_active: 1,
  };
}

function allowed(role: ApiUser['role'], table: string, operations: TableOperation[]) {
  for (const operation of ['read', 'create', 'update', 'delete'] as const) {
    expect(
      canAccessTable(user(role), table, operation),
      `${role} ${operation} ${table}`,
    ).toBe(operations.includes(operation));
  }
}

describe('table authorization policy', () => {
  it('keeps audit logs append-only for every role', () => {
    allowed('super_admin', 'audit_logs', ['read', 'create']);
    allowed('school_admin', 'audit_logs', ['read', 'create']);
    allowed('teacher', 'audit_logs', ['create']);
    allowed('student', 'audit_logs', []);
    allowed('guardian', 'audit_logs', []);
  });

  it('prevents school admins from changing global security tables', () => {
    allowed('school_admin', 'schools', ['read']);
    allowed('school_admin', 'user_roles', []);
    allowed('school_admin', 'system_settings', []);
    allowed('school_admin', 'user_profiles', ['read', 'create', 'update', 'delete']);
  });

  it('limits teachers to academic and self-service writes', () => {
    allowed('teacher', 'students', ['read']);
    allowed('teacher', 'attendance', ['read', 'create', 'update', 'delete']);
    allowed('teacher', 'exam_results', ['read', 'create', 'update', 'delete']);
    allowed('teacher', 'user_profiles', ['read']);
  });

  it('limits students and guardians to self-service data', () => {
    allowed('student', 'students', []);
    allowed('student', 'notifications', ['read']);
    allowed('student', 'notification_settings', ['read', 'create', 'update', 'delete']);
    allowed('guardian', 'feedback_submissions', ['read', 'create', 'update', 'delete']);
  });
});
