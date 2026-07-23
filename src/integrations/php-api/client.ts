import { queryClient } from '@/lib/query-client';

type ApiErrorBody = {
  error?: {
    message?: string;
    detail?: string | null;
  };
};

type ApiResponse<T> = {
  data: T;
};

export type PhpApiUser = {
  id: string;
  email: string;
  school_id: string | null;
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian';
  full_name: string;
  full_name_bangla?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  address_bangla?: string | null;
  approval_status?: string | null;
  is_active: number | boolean;
};

export type PhpApiSession = {
  access_token: string;
  token_type: 'bearer';
};

export type PhpApiProfile = {
  id: string;
  user_id: string;
  school_id: string | null;
  role: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian';
  full_name: string;
  full_name_bangla: string | null;
  phone: string | null;
  avatar_url?: string | null;
  address: string | null;
  address_bangla: string | null;
  is_active: number | boolean;
};

export type PhpPasswordResetResponse = {
  ok: boolean;
  reset_token?: string;
  reset_url?: string;
};

export type PhpSchoolRegistrationInput = {
  school: {
    name: string;
    name_bangla?: string | null;
    school_type: 'bangla_medium' | 'english_medium' | 'madrasha';
    address: string;
    address_bangla?: string | null;
    phone: string;
    email: string;
    eiin_number?: string | null;
    established_year?: number | null;
  };
  admin: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
  };
};

export type PhpSchoolRegistrationResponse = {
  school: { id: string; name: string };
  admin: { id: string; email: string };
};

export type PhpBootstrapStatus = {
  super_admin_exists: boolean;
};

export type PhpUploadResponse = {
  bucket: string;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
};

export type PhpTeacherPortalLink = {
  portal_url: string;
  plain_url: string;
  expires_at: string;
};

export type PhpPublicSchool = {
  id: string;
  name: string;
  name_bangla: string | null;
  school_type: string;
};

const API_TOKEN_KEY = 'schoolxnow-php-api-token';

function getBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL;
  if (!baseUrl) {
    throw new Error('Missing VITE_API_URL for the SchoolXNow API');
  }

  return String(baseUrl).replace(/\/$/, '');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(API_TOKEN_KEY);
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as ApiResponse<T> & ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error?.message || `API request failed with status ${response.status}`);
  }

  const method = String(options.method || 'GET').toUpperCase();
  const changesDashboardData =
    ['POST', 'PATCH', 'DELETE'].includes(method) &&
    (path.startsWith('/tables/') || path === '/auth/profile');
  if (changesDashboardData) {
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
  }

  return body.data;
}

export const phpApi = {
  tokenKey: API_TOKEN_KEY,

  async health() {
    const response = await fetch(`${getBaseUrl()}/health`);
    if (!response.ok) {
      throw new Error(`API health check failed with status ${response.status}`);
    }

    return response.json() as Promise<{ ok: boolean; service: string; time: string }>;
  },

  async login(email: string, password: string) {
    const data = await request<{ user: PhpApiUser; session: PhpApiSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem(API_TOKEN_KEY, data.session.access_token);
    return data;
  },

  async register(input: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    school_id?: string | null;
  }) {
    return request<{ id: string; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async registerSchool(input: PhpSchoolRegistrationInput) {
    return request<PhpSchoolRegistrationResponse>('/auth/register-school', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async listPublicSchools() {
    return request<PhpPublicSchool[]>('/public/schools');
  },

  async submitTeacherApplication(input: {
    school_id: string;
    full_name: string;
    full_name_bangla?: string | null;
    phone: string;
    address?: string | null;
    address_bangla?: string | null;
    qualification?: string | null;
    subject_specialization?: string | null;
    experience_years?: number;
  }) {
    return request<{ id: string }>('/auth/teacher-application', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async uploadFile(bucket: 'avatars' | 'student-photos' | 'documents', file: File) {
    const token = localStorage.getItem(API_TOKEN_KEY);
    const formData = new FormData();
    formData.set('file', file);

    const response = await fetch(`${getBaseUrl()}/uploads/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const body = (await response.json().catch(() => ({}))) as ApiResponse<PhpUploadResponse> & ApiErrorBody;
    if (!response.ok) {
      throw new Error(body.error?.message || `Upload failed with status ${response.status}`);
    }

    return body.data;
  },

  async me() {
    return request<PhpApiUser>('/auth/me');
  },

  async logout() {
    localStorage.removeItem(API_TOKEN_KEY);
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' }).catch(() => ({ ok: true }));
  },

  async updateProfile(input: {
    full_name: string;
    full_name_bangla?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    address?: string | null;
    address_bangla?: string | null;
  }) {
    return request<PhpApiProfile>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  },

  async requestPasswordReset(email: string, redirectTo?: string) {
    return request<PhpPasswordResetResponse>('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({
        email,
        redirect_to: redirectTo,
      }),
    });
  },

  async resetPassword(token: string, password: string) {
    return request<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async createTeacherPortalLink(input: {
    email: string;
    redirect_to?: string;
    expires_in?: number;
  }) {
    return request<PhpTeacherPortalLink>('/auth/teacher-portal-link', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async loginWithTeacherPortalToken(token: string) {
    const data = await request<{ user: PhpApiUser; session: PhpApiSession }>('/auth/teacher-portal-login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    localStorage.setItem(API_TOKEN_KEY, data.session.access_token);
    return data;
  },

  async bootstrapStatus() {
    return request<PhpBootstrapStatus>('/bootstrap/status');
  },

  async createSuperAdmin(input: {
    email: string;
    password: string;
    full_name: string;
    secret_key: string;
  }) {
    return request<{ success: boolean; message: string; user_id: string }>('/bootstrap/create-super-admin', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  table<T extends object>(table: string) {
    return {
      list(params: Record<string, string | number | boolean | null | undefined> = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query.set(key, String(value));
          }
        });
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return request<T[]>(`/tables/${encodeURIComponent(table)}${suffix}`);
      },

      count(params: Record<string, string | number | boolean | null | undefined> = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query.set(key, String(value));
          }
        });
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return request<{ count: number }>(`/tables/${encodeURIComponent(table)}/count${suffix}`);
      },

      get(id: string) {
        return request<T>(`/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`);
      },

      create(input: Partial<T>) {
        return request<T>(`/tables/${encodeURIComponent(table)}`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
      },

      update(id: string, input: Partial<T>) {
        return request<T>(`/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
      },

      delete(id: string) {
        return request<void>(`/tables/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      },
    };
  },
};
