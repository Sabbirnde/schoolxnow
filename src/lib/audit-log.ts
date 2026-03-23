/**
 * Audit Logging System
 * Tracks all changes to school data for compliance, debugging, and accountability
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Type Definitions
// ============================================================================

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'RESTORE'
  | 'BULK_IMPORT'
  | 'STATUS_CHANGE';

export type AuditEntityType = 
  | 'student' 
  | 'teacher' 
  | 'class' 
  | 'subject' 
  | 'exam' 
  | 'marks' 
  | 'attendance'
  | 'timetable'
  | 'class_assignment';

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  old_values?: any;
  new_values?: any;
  success: boolean;
  error_message?: string | null;
  ip_address?: unknown;
  user_agent?: string | null;
  metadata?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// Audit Logging Functions
// ============================================================================

/**
 * Create an audit log entry
 */
export async function logAuditEvent(
  userId: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  options?: {
    newValues?: any;
    metadata?: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase.from('audit_logs').insert([
      {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        new_values: options?.newValues || null,
        metadata: options?.metadata || null,
        success: true,
      },
    ]);

    if (error) {
      console.error('Audit log error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return false;
  }
}

/**
 * Log a failed audit event
 */
export async function logFailedAuditEvent(
  userId: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  errorMessage: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('audit_logs').insert([
      {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        success: false,
        error_message: errorMessage,
      },
    ]);

    if (error) {
      console.error('Failed to log failed audit event:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error logging failed audit event:', error);
    return false;
  }
}

/**
 * Fetch audit logs for an entity
 */
export async function fetchAuditLogs(
  entityType?: AuditEntityType,
  entityId?: string,
  limit: number = 100
): Promise<AuditLog[]> {
  try {
    let baseQuery = supabase
      .from('audit_logs')
      .select('*');

    if (entityType) {
      baseQuery = baseQuery.eq('entity_type', entityType);
    }

    if (entityId) {
      baseQuery = baseQuery.eq('entity_id', entityId);
    }

    const query = baseQuery
      .order('timestamp', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) throw error;
    return (data as AuditLog[]) || [];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}

/**
 * Fetch user activity summary
 */
export async function fetchUserActivitySummary(
  userId: string,
  days: number = 30
): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  lastAction?: AuditLog;
  recentFailures: number;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const baseQuery = supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false });

    const { data, error } = await baseQuery;

    if (error) throw error;

    const logs = (data as AuditLog[]) || [];
    const actionsByType: Record<string, number> = {};

    logs.forEach(log => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
    });

    const failureCount = logs.filter(l => !l.success).length;

    return {
      totalActions: logs.length,
      actionsByType,
      lastAction: logs[0],
      recentFailures: failureCount,
    };
  } catch (error) {
    console.error('Error fetching user activity summary:', error);
    return {
      totalActions: 0,
      actionsByType: {},
      recentFailures: 0,
    };
  }
}

// ============================================================================
// Data Validation Functions
// ============================================================================

/**
 * Validate if a class can be deleted (no enrolled students)
 */
export async function validateClassDeletion(classId: string): Promise<ValidationError | null> {
  try {
    const baseQuery = supabase
      .from('students')
      .select('id')
      .eq('class_id', classId)
      .eq('status', 'active');

    const { data, error } = await baseQuery;

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        field: 'class_id',
        message: `Cannot delete class with ${data.length} enrolled student${data.length !== 1 ? 's' : ''}. Please transfer or deactivate students first.`,
        code: 'CLASS_HAS_ENROLLED_STUDENTS',
      };
    }

    return null;
  } catch (error) {
    console.error('Error validating class deletion:', error);
    throw error;
  }
}

/**
 * Validate if a teacher can be deleted (no class assignments)
 */
export async function validateTeacherDeletion(teacherId: string): Promise<ValidationError | null> {
  try {
    const baseQuery = supabase
      .from('timetable')
      .select('id')
      .eq('teacher_id', teacherId);

    const { data, error } = await baseQuery;

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        field: 'teacher_id',
        message: `Cannot delete teacher with ${data.length} class assignment${data.length !== 1 ? 's' : ''}. Please reassign classes first.`,
        code: 'TEACHER_HAS_ASSIGNMENTS',
      };
    }

    return null;
  } catch (error) {
    console.error('Error validating teacher deletion:', error);
    throw error;
  }
}

/**
 * Validate if a subject can be deleted (no active exams or assignments)
 */
export async function validateSubjectDeletion(subjectId: string): Promise<ValidationError | null> {
  try {
    const examsResult = await (supabase.from('exams') as any).select('id').eq('subject_id', subjectId);
    const assignmentsResult = await (supabase.from('timetable') as any).select('id').eq('subject_id', subjectId);
    
    const exams = examsResult.data || [];
    const assignments = assignmentsResult.data || [];

    if (exams && exams.length > 0) {
      return {
        field: 'subject_id',
        message: `Cannot delete subject with ${exams.length} exam${exams.length !== 1 ? 's' : ''}. Please archive exams first.`,
        code: 'SUBJECT_HAS_EXAMS',
      };
    }

    if (assignments && assignments.length > 0) {
      return {
        field: 'subject_id',
        message: `Cannot delete subject with ${assignments.length} teacher assignment${assignments.length !== 1 ? 's' : ''}. Please remove assignments first.`,
        code: 'SUBJECT_HAS_ASSIGNMENTS',
      };
    }

    return null;
  } catch (error) {
    console.error('Error validating subject deletion:', error);
    throw error;
  }
}

/**
 * Check for duplicate student ID within school
 */
export async function checkStudentIDDuplicate(
  schoolId: string,
  studentId: string,
  excludeId?: string
): Promise<ValidationError | null> {
  try {
    let query = supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        field: 'student_id',
        message: `Student ID "${studentId}" is already in use. Please use a unique ID.`,
        code: 'STUDENT_ID_DUPLICATE',
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking student ID duplicate:', error);
    throw error;
  }
}

/**
 * Check for duplicate email - Teachers
 */
export async function checkTeacherEmailDuplicate(
  schoolId: string,
  email: string,
  excludeId?: string
): Promise<ValidationError | null> {
  try {
    let query = supabase
      .from('teachers')
      .select('id')
      .eq('school_id', schoolId)
      .eq('email', email.toLowerCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        field: 'email',
        message: `Email "${email}" is already registered. Please use a different email.`,
        code: 'EMAIL_DUPLICATE',
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking teacher email duplicate:', error);
    throw error;
  }
}

/**
 * Check for duplicate email - Students
 */
export async function checkStudentEmailDuplicate(
  schoolId: string,
  email: string,
  excludeId?: string
): Promise<ValidationError | null> {
  try {
    const queryResult = await (supabase.from('students') as any)
      .select('id')
      .eq('school_id', schoolId)
      .eq('email', email.toLowerCase());

    const { data, error } = queryResult;

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        field: 'email',
        message: `Email "${email}" is already registered. Please use a different email.`,
        code: 'EMAIL_DUPLICATE',
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking student email duplicate:', error);
    throw error;
  }
}

/**
 * Check for duplicate class name within school
 */
export async function checkClassNameDuplicate(
  schoolId: string,
  name: string,
  section: string,
  excludeId?: string
): Promise<ValidationError | null> {
  try {
    let query = supabase
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', name)
      .eq('section', section);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        field: 'name',
        message: `Class "${name} - Section ${section}" already exists.`,
        code: 'CLASS_DUPLICATE',
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking class name duplicate:', error);
    throw error;
  }
}

/**
 * Validate required fields
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): ValidationError | null {
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return {
        field,
        message: `${formatFieldName(field)} is required.`,
        code: 'REQUIRED_FIELD',
      };
    }
  }
  return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationError | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      field: 'email',
      message: 'Invalid email format.',
      code: 'INVALID_EMAIL',
    };
  }
  return null;
}

/**
 * Validate phone format
 */
export function validatePhone(phone: string): ValidationError | null {
  const phoneRegex = /^[0-9]{10,}$/;
  if (phone && !phoneRegex.test(phone.replace(/[-\s]/g, ''))) {
    return {
      field: 'phone',
      message: 'Phone number must be at least 10 digits.',
      code: 'INVALID_PHONE',
    };
  }
  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
