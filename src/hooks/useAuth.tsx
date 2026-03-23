import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useThrottledFetch } from '@/hooks/useThrottledFetch';

interface UserProfile {
  id: string;
  user_id: string;
  school_id: string | null;
  role: 'super_admin' | 'school_admin' | 'teacher';
  full_name: string;
  full_name_bangla: string | null;
  phone: string | null;
  address: string | null;
  address_bangla: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  approval_status: string | null;
}

type ProfileStateStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface ProfileState {
  status: ProfileStateStatus;
  userId: string | null;
  error: string | null;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  profileState: ProfileState;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role?: string, schoolId?: string) => Promise<{ error: any }>;
  signInWithOtp: (email: string, options?: { redirectTo?: string }) => Promise<{ error: any }>;
  verifyOtp: (email: string, token: string, type: 'email' | 'sms') => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileState, setProfileState] = useState<ProfileState>({
    status: 'idle',
    userId: null,
    error: null,
    updatedAt: new Date().toISOString(),
  });
  const currentUserIdRef = useRef<string | null>(null);
  const profileFetchSeqRef = useRef(0);

  const transitionProfileState = useCallback((status: ProfileStateStatus, userId: string | null, error: string | null = null) => {
    setProfileState({
      status,
      userId,
      error,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    // Prevent fetch if user has been cleared (logout)
    if (!userId) return;

    const fetchSeq = ++profileFetchSeqRef.current;
    transitionProfileState('loading', userId, null);

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
        if (fetchSeq === profileFetchSeqRef.current && currentUserIdRef.current === userId) {
          setProfile(null);
          transitionProfileState('error', userId, profileError.message || 'Failed to fetch profile');
        }
        return;
      }

      // Fetch user role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      // Use user_roles first, then fallback to role from user_profiles.
      if (fetchSeq !== profileFetchSeqRef.current || currentUserIdRef.current !== userId) {
        return;
      }

      if (profileData) {
        const resolvedRole = roleData?.role ?? profileData.role;
        setProfile({
          ...profileData,
          role: resolvedRole,
        });
        transitionProfileState('ready', userId, null);
      } else {
        setProfile(null);
        transitionProfileState('missing', userId, null);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      if (fetchSeq === profileFetchSeqRef.current && currentUserIdRef.current === userId) {
        setProfile(null);
        transitionProfileState(
          'error',
          userId,
          error instanceof Error ? error.message : 'Unknown profile fetch error'
        );
      }
    }
  }, [transitionProfileState]);

  // Create throttled version for realtime-triggered fetches (1 second window)
  const [throttledFetchProfile] = useThrottledFetch(
    (userId: string) => fetchProfile(userId),
    1000
  );

  useEffect(() => {
    // Set up auth state listener with improved error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('Token refresh failed, clearing session');
          setSession(null);
          setUser(null);
          setProfile(null);
          currentUserIdRef.current = null;
          profileFetchSeqRef.current += 1;
          transitionProfileState('idle', null, null);
          setLoading(false);
          return;
        }

        // Handle signed out or token expired
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          console.log('User signed out, clearing all auth state');
          setSession(null);
          setUser(null);
          setProfile(null);
          currentUserIdRef.current = null;
          profileFetchSeqRef.current += 1;
          transitionProfileState('idle', null, null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;
        
        if (session?.user) {
          transitionProfileState('loading', session.user.id, null);
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          transitionProfileState('idle', null, null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session with error handling
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          // If there's an error getting the session, try to refresh
          if (error.message?.includes('refresh')) {
            console.log('Attempting to recover from refresh token error');
            await supabase.auth.refreshSession();
            return;
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        currentUserIdRef.current = session?.user?.id ?? null;
        
        if (session?.user) {
          transitionProfileState('loading', session.user.id, null);
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          transitionProfileState('idle', null, null);
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        // Clear potentially corrupted session data
        setSession(null);
        setUser(null);
        setProfile(null);
        currentUserIdRef.current = null;
        profileFetchSeqRef.current += 1;
        transitionProfileState('error', null, error instanceof Error ? error.message : 'Session initialization failed');
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    // Set up separate narrow real-time subscriptions for profile and role changes
    let profileChannel: any = null;
    let roleChannel: any = null;
    
    const setupRealtimeSubscriptions = (userId: string) => {
      try {
        // Separate channel for profile updates only (narrowed to UPDATE events)
        profileChannel = supabase.channel(`auth-profile-changes:${userId}`);
        profileChannel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[Auth] Profile update detected:', payload.new?.id);
            if (currentUserIdRef.current === userId) {
              throttledFetchProfile(userId);
            }
          }
        );
        
        profileChannel.subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[Auth] Profile channel status:', status);
          }
        });

        // Separate narrow channel for role changes (INSERT/UPDATE only, no DELETE)
        roleChannel = supabase.channel(`auth-role-changes:${userId}`);
        roleChannel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_roles',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[Auth] Role inserted:', payload.new?.role);
            if (currentUserIdRef.current === userId) {
              throttledFetchProfile(userId);
            }
          }
        );
        
        roleChannel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_roles',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[Auth] Role updated:', payload.new?.role);
            if (currentUserIdRef.current === userId) {
              throttledFetchProfile(userId);
            }
          }
        );
        
        roleChannel.subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[Auth] Role channel status:', status);
          }
        });
      } catch (error) {
        console.error('[Auth] Error setting up realtime subscriptions:', error);
      }
    };

    if (user?.id) {
      setupRealtimeSubscriptions(user.id);
    }

    return () => {
      subscription.unsubscribe();
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }
      if (roleChannel) {
        supabase.removeChannel(roleChannel);
      }
    };
  }, [user?.id, fetchProfile, transitionProfileState]);

  const signIn = async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password;

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      
      if (error) {
        // Handle specific auth errors with better messages
        if (error.message?.includes('refresh')) {
          return { error: { ...error, message: 'Session expired. Please try logging in again.' } };
        }
        if (error.message?.includes('Invalid login credentials')) {
          return { error: { ...error, message: 'Invalid email or password. Please check your credentials.' } };
        }
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          return { error: { ...error, message: 'Email not confirmed. Please verify your email before logging in.' } };
        }
      }
      
      return { error };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error: { message: 'An unexpected error occurred. Please try again.' } };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role?: string, schoolId?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: normalizedFullName,
          role: role || 'teacher',
          school_id: schoolId || null,
        },
      },
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();

      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return { error: { ...error, message: 'This email is already registered. Please sign in or reset your password.' } };
      }

      if (msg.includes('database error saving new user')) {
        return {
          error: {
            ...error,
            message: 'Account creation is temporarily unavailable due to a server profile setup issue. Please ask admin to run the latest Supabase migration and try again.'
          }
        };
      }

      if (msg.includes('password')) {
        return { error: { ...error, message: error.message } };
      }
    }
    
    // If signup is successful and user is immediately confirmed (no email verification required)
    if (data.user && !error && role === 'super_admin') {
      // For super admin, update the profile and role immediately after creation
      try {
        // Update profile
        await supabase
          .from('user_profiles')
          .update({
            approval_status: 'approved',
            is_active: true,
            school_id: null
          })
          .eq('user_id', data.user.id);
        
        // Ensure role is set in user_roles table
        await supabase
          .from('user_roles')
          .upsert({
            user_id: data.user.id,
            role: 'super_admin'
          });
      } catch (updateError) {
        console.error('Error updating super admin profile:', updateError);
      }
    }
    
    if (data.user && !error && role !== 'super_admin') {
      // The profile will be created automatically by the handle_new_user trigger
      console.log('User signed up successfully:', data.user.id);
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      // Always clear local state, even if signOut fails
      setUser(null);
      setSession(null);
      setProfile(null);
      currentUserIdRef.current = null;
      profileFetchSeqRef.current += 1;
      transitionProfileState('idle', null, null);
      
      if (error && !error.message?.includes('refresh')) {
        console.error('Sign out error:', error);
        return { error };
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Sign out error:', error);
      // Still clear local state on error
      setUser(null);
      setSession(null);
      setProfile(null);
      currentUserIdRef.current = null;
      profileFetchSeqRef.current += 1;
      transitionProfileState('idle', null, null);
      return { error: null }; // Don't block user from "signing out" locally
    }
  };

  const signInWithOtp = async (email: string, options?: { redirectTo?: string }) => {
    try {
      const redirectUrl = options?.redirectTo || `${window.location.origin}/teacher-portal`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: false, // Only allow existing users
        },
      });
      
      if (error) {
        console.error('OTP sign in error:', error);
        return { error };
      }
      
      console.log('OTP sent to:', email);
      return { error: null };
    } catch (error: any) {
      console.error('Sign in with OTP error:', error);
      return { error };
    }
  };

  const verifyOtp = async (email: string, token: string, type: 'email' | 'sms' = 'email') => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type,
      });
      
      if (error) {
        console.error('OTP verification error:', error);
        return { error };
      }
      
      console.log('OTP verified for:', email);
      return { error: null };
    } catch (error: any) {
      console.error('OTP verification error:', error);
      return { error };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    profileState,
    loading,
    signIn,
    signUp,
    signInWithOtp,
    verifyOtp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
