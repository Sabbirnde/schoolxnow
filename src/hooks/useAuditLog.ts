/**
 * Hook for managing audit logs
 * Simplifies integration of audit logging into components
 */

import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import {
  logAuditEvent,
  logFailedAuditEvent,
  fetchAuditLogs,
  AuditAction,
  AuditEntityType,
  AuditLog,
  AuditEntityType as EntityType,
} from '@/lib/audit-log';

interface UseAuditLogOptions {
  entityType: EntityType;
  entityId?: string;
}

/**
 * Hook for managing audit logs in components
 */
export function useAuditLog(options: UseAuditLogOptions) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Log an action
   */
  const logAction = useCallback(
    async (
      action: AuditAction,
      entityId: string,
      logOptions?: {
        newValues?: any;
        metadata?: Record<string, any>;
      }
    ) => {
      if (!profile?.user_id) {
        console.error('Missing user_id for audit logging');
        return false;
      }

      return logAuditEvent(
        profile.user_id,
        action,
        options.entityType,
        entityId,
        logOptions
      );
    },
    [profile?.user_id, options.entityType]
  );

  /**
   * Log a failed action
   */
  const logFailedAction = useCallback(
    async (action: AuditAction, entityId: string, errorMessage: string) => {
      if (!profile?.user_id) {
        console.error('Missing user_id for audit logging');
        return false;
      }

      return logFailedAuditEvent(
        profile.user_id,
        action,
        options.entityType,
        entityId,
        errorMessage
      );
    },
    [profile?.user_id, options.entityType]
  );

  /**
   * Fetch audit logs for this entity
   */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const auditLogs = await fetchAuditLogs(
        options.entityType,
        options.entityId,
        50
      );
      setLogs(auditLogs);
    } finally {
      setLoading(false);
    }
  }, [options.entityType, options.entityId]);

  return {
    logs,
    loading,
    logAction,
    logFailedAction,
    fetchLogs,
  };
}
