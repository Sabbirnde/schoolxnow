import { afterEach, describe, expect, it } from 'vitest';
import {
  invalidateSchoolAdminTableMutation,
  queryClient,
  schoolAdminQueryKeys,
} from '@/lib/query-client';

describe('school-admin query caching', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('builds stable, resource-specific query keys', () => {
    expect(schoolAdminQueryKeys.dashboard('school-1')).toEqual([
      'school-admin',
      'school-1',
      'dashboard',
    ]);
    expect(schoolAdminQueryKeys.students('school-1', { status: 'active', page: 2 })).toEqual([
      'school-admin',
      'school-1',
      'students',
      { page: 2, status: 'active' },
    ]);
    expect(schoolAdminQueryKeys.attendance('school-1', '2026-07-24')).toEqual([
      'school-admin',
      'school-1',
      'attendance',
      '2026-07-24',
    ]);
  });

  it('invalidates only the affected school resource and dashboard', async () => {
    const schoolOneDashboard = schoolAdminQueryKeys.dashboard('school-1');
    const schoolTwoDashboard = schoolAdminQueryKeys.dashboard('school-2');
    const schoolOneStudents = schoolAdminQueryKeys.students('school-1', { page: 1 });
    const schoolOneAttendance = schoolAdminQueryKeys.attendance('school-1', '2026-07-24');

    queryClient.setQueryData(schoolOneDashboard, {});
    queryClient.setQueryData(schoolTwoDashboard, {});
    queryClient.setQueryData(schoolOneStudents, []);
    queryClient.setQueryData(schoolOneAttendance, []);

    await invalidateSchoolAdminTableMutation('students', { school_id: 'school-1' });

    expect(queryClient.getQueryState(schoolOneDashboard)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(schoolOneStudents)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(schoolTwoDashboard)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(schoolOneAttendance)?.isInvalidated).toBe(false);
  });

  it('does not invalidate the dashboard for an unrelated small mutation', async () => {
    const dashboard = schoolAdminQueryKeys.dashboard('school-1');
    const settings = schoolAdminQueryKeys.resource('school-1', 'notification_settings');
    queryClient.setQueryData(dashboard, {});
    queryClient.setQueryData(settings, {});

    await invalidateSchoolAdminTableMutation('notification_settings', {
      school_id: 'school-1',
    });

    expect(queryClient.getQueryState(settings)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(dashboard)?.isInvalidated).toBe(false);
  });
});
