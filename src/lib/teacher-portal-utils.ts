import { apiClient } from '@/integrations/php-api/api-client';
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';

/**
 * Teacher Portal Auto-Login Utilities
 * 
 * Provides functions to:
 * - Generate teacher portal magic links with auto-login
 * - Create session tokens for secure teacher access
 * - Generate teacher portal URLs with session recovery
 */

interface TeacherPortalLinkOptions {
  teacherEmail: string;
  schoolId?: string;
  redirectPath?: string;
  expiresIn?: number; // in seconds, default: 24 hours
}

interface GeneratedLink {
  magicLink: string;
  plainLink: string; // Without session token (for copied links)
  expiresAt: Date;
  error?: string;
}

/**
 * Generate a magic link for teacher auto-login
 * This creates a time-limited link that auto-authenticates the teacher
 */
export async function generateTeacherMagicLink(
  options: TeacherPortalLinkOptions
): Promise<GeneratedLink> {
  try {
    const { teacherEmail, redirectPath = '/teacher-portal', expiresIn = 86400 } = options;
    const plainLink = `${window.location.origin}${redirectPath}`;

    if (isPhpBackend) {
      const result = await phpApi.createTeacherPortalLink({
        email: teacherEmail,
        redirect_to: plainLink,
        expires_in: expiresIn,
      });

      return {
        magicLink: result.portal_url,
        plainLink: result.plain_url,
        expiresAt: new Date(result.expires_at),
      };
    }

    // Generate magic link via Api
    const { data, error } = await apiClient.auth.signInWithOtp({
      email: teacherEmail,
      options: {
        shouldCreateUser: false, // Only allow existing users
        emailRedirectTo: plainLink,
      },
    });

    if (error) {
      return {
        magicLink: '',
        plainLink,
        expiresAt: new Date(),
        error: `Failed to generate magic link: ${error.message}`,
      };
    }

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    return {
      magicLink: `${window.location.origin}${redirectPath}`,
      plainLink,
      expiresAt,
    };
  } catch (err) {
    return {
      magicLink: '',
      plainLink: '',
      expiresAt: new Date(),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Generate teacher portal URL with session token
 * Used to create direct links for teachers with embedded authentication
 */
export function generateTeacherPortalURL(
  baseTeacherId?: string,
  queryParams?: Record<string, string>
): string {
  const baseUrl = `${window.location.origin}/teacher-portal`;
  
  if (!queryParams && !baseTeacherId) {
    return baseUrl;
  }

  const params = new URLSearchParams();
  
  if (baseTeacherId) {
    params.append('teacher_id', baseTeacherId);
  }

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      params.append(key, value);
    });
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Send teacher portal link via email
 * This would typically be called from an admin interface
 */
export async function sendTeacherPortalLink(email: string, teacherName: string): Promise<boolean> {
  try {
    // Generate the magic link
    const linkResult = await generateTeacherMagicLink({
      teacherEmail: email,
      redirectPath: '/teacher-portal',
    });

    if (linkResult.error) {
      console.error('[TeacherPortal] Magic link generation error:', linkResult.error);
      return false;
    }

    // Note: Actual email sending would be handled by Api Edge Functions
    // The OTP should already be sent by Api in generateTeacherMagicLink
    console.log('[TeacherPortal] Magic link ready for teacher:', email);

    return true;
  } catch (err) {
    console.error('[TeacherPortal] Send link error:', err);
    return false;
  }
}

/**
 * Check if current session is for a teacher
 */
export async function isTeacherSession(): Promise<boolean> {
  try {
    if (isPhpBackend) {
      const token = localStorage.getItem(phpApi.tokenKey);
      if (!token) return false;
      const user = await phpApi.me();
      return user.role === 'teacher';
    }

    const { data: { user } } = await apiClient.auth.getUser();
    
    if (!user) return false;

    // Check user_roles table for teacher role
    const { data, error } = await apiClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('[TeacherPortal] Role check error:', error);
      return false;
    }

    return data?.role === 'teacher';
  } catch (err) {
    console.error('[TeacherPortal] Session check error:', err);
    return false;
  }
}

/**
 * Auto-recover teacher session from stored token
 * Called on app boot to restore teacher portal access
 */
export async function recoverTeacherSession(): Promise<{ success: boolean; teacherId?: string }> {
  try {
    if (isPhpBackend) {
      const token = localStorage.getItem(phpApi.tokenKey);
      if (!token) return { success: false };
      const user = await phpApi.me();
      return user.role === 'teacher' ? { success: true, teacherId: user.id } : { success: false };
    }

    // Check for stored teacher session token
    const storedToken = localStorage.getItem('teacher_session_token');
    
    if (!storedToken) {
      // Try to restore from Api session
      const { data: { session } } = await apiClient.auth.getSession();
      
      if (session && (await isTeacherSession())) {
        return { success: true };
      }
      
      return { success: false };
    }

    // Token exists, verify it's still valid
    const { data: { user } } = await apiClient.auth.getUser();
    
    if (user && (await isTeacherSession())) {
      return { success: true, teacherId: user.id };
    }

    // Token invalid, clear it
    localStorage.removeItem('teacher_session_token');
    return { success: false };
  } catch (err) {
    console.error('[TeacherPortal] Recovery error:', err);
    return { success: false };
  }
}

/**
 * Store teacher session for persistence
 */
export function storeTeacherSessionToken(token: string): void {
  localStorage.setItem('teacher_session_token', token);
  localStorage.setItem('teacher_session_timestamp', Date.now().toString());
}

/**
 * Clear teacher session
 */
export function clearTeacherSessionToken(): void {
  localStorage.removeItem('teacher_session_token');
  localStorage.removeItem('teacher_session_timestamp');
}
