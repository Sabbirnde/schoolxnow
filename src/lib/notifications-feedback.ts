import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import type { Json } from '@/integrations/database/types';

export interface NotificationPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: 'en' | 'bn';
  notifications_email: boolean;
  notifications_sms: boolean;
  notifications_push: boolean;
  show_profile_picture?: boolean;
  two_factor_enabled?: boolean;
}

interface NotificationSettingsRow {
  id: string;
  school_id: string | null;
  user_id: string;
  settings: string | Json | null;
  created_at?: string;
  updated_at?: string;
}

export interface FeedbackSubmissionInput {
  category?: string | null;
  rating?: number | null;
  message: string;
}

export interface NotificationItem {
  id: string;
  school_id: string | null;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean | number;
  created_at: string;
}

export interface NotificationCreateInput {
  user_id?: string | null;
  title: string;
  message: string;
  type?: string;
}

export interface FeedbackSubmission {
  id: string;
  school_id: string | null;
  user_id: string | null;
  category: string | null;
  rating: number | null;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function parseSettings(value: string | Json | null): Partial<NotificationPreferences> {
  if (!value) return {};
  if (typeof value !== 'string') return value as Partial<NotificationPreferences>;

  try {
    return JSON.parse(value) as Partial<NotificationPreferences>;
  } catch {
    return {};
  }
}

export async function loadNotificationPreferences(
  userId: string,
  defaults: NotificationPreferences
): Promise<{ id: string | null; preferences: NotificationPreferences }> {
  if (!isPhpBackend) {
    return { id: null, preferences: defaults };
  }

  const rows = await phpApi.table<NotificationSettingsRow>('notification_settings').list({
    user_id: userId,
    limit: 1,
  });
  const row = rows[0];

  if (!row) {
    return { id: null, preferences: defaults };
  }

  return {
    id: row.id,
    preferences: {
      ...defaults,
      ...parseSettings(row.settings),
    },
  };
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
  existingId?: string | null
) {
  if (!isPhpBackend) {
    return;
  }

  const payload = {
    user_id: userId,
    settings: preferences as unknown as Json,
  };

  if (existingId) {
    await phpApi.table<typeof payload>('notification_settings').update(existingId, payload);
    return;
  }

  await phpApi.table<typeof payload>('notification_settings').create(payload);
}

export async function listNotifications(options: { unreadOnly?: boolean } = {}) {
  if (!isPhpBackend) {
    return [];
  }

  const rows = await phpApi.table<NotificationItem>('notifications').list({
    ...(options.unreadOnly ? { is_read: 0 } : {}),
    sort: 'created_at',
    order: 'desc',
    limit: 100,
  });

  return rows.map((row) => ({
    ...row,
    is_read: row.is_read === true || row.is_read === 1,
  }));
}

export async function createNotification(input: NotificationCreateInput) {
  if (!isPhpBackend) {
    return null;
  }

  return phpApi.table<NotificationItem>('notifications').create({
    user_id: input.user_id || null,
    title: input.title,
    message: input.message,
    type: input.type || 'info',
    is_read: 0,
  });
}

export async function markNotificationRead(id: string) {
  if (!isPhpBackend) {
    return null;
  }

  return phpApi.table<NotificationItem>('notifications').update(id, { is_read: 1 });
}

export async function submitFeedback(input: FeedbackSubmissionInput) {
  if (!isPhpBackend) {
    return null;
  }

  return phpApi.table<FeedbackSubmission>('feedback_submissions').create({
    category: input.category || null,
    rating: input.rating ?? null,
    message: input.message,
    status: 'new',
  });
}

export async function listFeedbackSubmissions(status?: string) {
  if (!isPhpBackend) {
    return [];
  }

  return phpApi.table<FeedbackSubmission>('feedback_submissions').list({
    ...(status ? { status } : {}),
    sort: 'created_at',
    order: 'desc',
    limit: 100,
  });
}
