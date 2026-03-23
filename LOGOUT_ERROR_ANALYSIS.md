# Comprehensive Logout Error Analysis

**Date**: March 23, 2026  
**Status**: 🔴 CRITICAL - Multiple potential error sources during logout  
**Focus**: What triggers "Something went wrong" ErrorBoundary message

---

## Executive Summary

The logout flow has **17+ potential error sources** that could trigger the ErrorBoundary to display "Something went wrong". The primary issue is that **real-time subscriptions and async queries continue firing after the user's authentication state is cleared**, attempting to access data with an invalid/null session.

---

## 1. CRITICAL - SuperAdminDashboard Real-Time Subscriptions

**File**: [src/components/SuperAdminDashboard.tsx](src/components/SuperAdminDashboard.tsx)

### Issue 1a: Unprotected useEffect with Subscriptions
**Location**: Lines 103-143

```tsx
useEffect(() => {
  fetchDashboardData();  // ❌ Called without user check
  
  // Set up real-time subscriptions WITHOUT auth check
  const schoolsChannel = supabase
    .channel('schools_changes')
    .on('postgres_changes' as any, 
      { event: '*', schema: 'public', table: 'schools' }, 
      () => {
        console.log('School data changed, refreshing dashboard...');
        fetchDashboardData();  // ❌ This fires even after logout
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Subscribed to schools changes');
      }
    });

  const studentsChannel = supabase
    .channel('students_changes') 
    .on('postgres_changes' as any, 
      { event: '*', schema: 'public', table: 'students' }, 
      () => {
        console.log('Student data changed, refreshing dashboard...');
        fetchDashboardData();  // ❌ Executes after profile is null
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(schoolsChannel);
    supabase.removeChannel(studentsChannel);
  };
}, []);  // ❌ Empty dependency array - useEffect only runs once!
```

**Problem**: 
- `useEffect` runs once on mount with empty dependency array
- No cleanup when user logs out
- Subscriptions persist in memory
- When Supabase fires a `postgres_changes` event, it calls the callback
- The callback tries to call `fetchDashboardData()` 
- This makes Supabase queries with a now-invalid session → **ERROR**

**Line 155-200**: `fetchDashboardData()` executes multiple `.select()` calls without checking if user is authenticated:
```tsx
const fetchDashboardData = async () => {
  try {
    setLoading(true);
    
    // ❌ No check for user session here
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });

    if (schoolsError) throw schoolsError;  // ❌ Error after logout
    
    // More queries without auth checks...
  } catch (error) {
    // Error gets caught but component state might be corrupted
  }
};
```

**Error Flow**:
1. User navigates to SuperAdminDashboard
2. Real-time listener subscribed
3. User clicks "Sign Out" → `signOut()` clears `profile`, `user`, `session`
4. User redirected to Landing page
5. **BUT**: Real-time listeners still active in memory
6. Someone updates a school in database
7. Supabase fires `postgres_changes` event
8. Callback tries `fetchDashboardData()` with null session
9. Query fails → error thrown
10. **If this happens before redirect completes, component might still be mounted**
11. Error thrown in callback → caught by ErrorBoundary

---

## 2. CRITICAL - StudentManagement Real-Time Callbacks

**File**: [src/components/StudentManagement.tsx](src/components/StudentManagement.tsx)

### Issue 2a: Subscriptions with Null Profile Check Missing
**Location**: Lines 168-215

```tsx
useEffect(() => {
  if (profile?.school_id) {
    fetchData();  // ❌ Only checks profile?.school_id, not if profile exists after logout
  }

  // ❌ Subscriptions set up WITHOUT checking if user is still logged in
  const studentsChannel = supabase
    .channel('students_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'students'
      },
      (payload) => {
        console.log('Student change detected:', payload);
        if (profile?.school_id) {  // ⚠️ Stale closure - profile is old value
          fetchData();  // ❌ Tries to query with old profile reference
        }
      }
    )
    .subscribe();

  const classesChannel = supabase
    .channel('students_classes_updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'classes' },
      (payload) => {
        console.log('Class change detected:', payload);
        if (profile?.school_id) {  // ⚠️ Stale closure again
          fetchData();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(studentsChannel);
    supabase.removeChannel(classesChannel);
  };
}, [profile?.school_id, toast]);  // ⚠️ profile?.school_id may not be sufficient
```

**Problem**:
- `profile` in the callback is a **stale closure** - captures old value
- When profile becomes null on logout, callback still references old profile
- `fetchData()` gets called with invalid session
- If a class is modified in the database during logout, this triggers

**Line 118-168**: `fetchData()` function makes queries without session validation:
```tsx
const fetchData = useCallback(async () => {
  if (!profile?.school_id) {  // ✓ Has check
    setLoading(false);
    return;
  }

  try {
    setLoading(true);

    const { data: studentsData, error: studentsError } = await (supabase as any)
      .from('students')
      .select('*')
      .eq('school_id', profile.school_id)  // ❌ profile could be null here if logout happened
      .order('admission_date', { ascending: false });

    if (studentsError) throw studentsError;  // ❌ Query error with invalid session
    // ...
  } catch (error: unknown) {
    console.error('Error fetching data:', error);
    toast({
      title: "Error",
      description: "Failed to load students data",
      variant: "destructive",
    });
  }
}, [profile?.school_id, toast]);
```

---

## 3. CRITICAL - ClassPerformanceAnalytics Missing Auth Guard

**File**: [src/components/ClassPerformanceAnalytics.tsx](src/components/ClassPerformanceAnalytics.tsx)

### Issue 3a: useEffect with No Profile Existence Check
**Location**: Lines 264+

```tsx
useEffect(() => {
  // ❌ NO CHECK if profile exists!
  if (!profile?.school_id) return;  // Only checks school_id, not profile itself
  
  fetchAnalytics();  // Calls with potentially null profile
}, [profile?.school_id, classId, subjectId, dateRange]);
```

**Problem**:
- On logout, `profile` becomes null
- Condition `!profile?.school_id` = `!(null?.school_id)` = `!undefined` = `true`
- So it returns early ✓
- BUT there's a race condition: if logout happens mid-fetch, `fetchAnalytics()` could be resolving with old profile reference

**Line 69+**: `fetchAnalytics()` makes multiple queries:
```tsx
const fetchAnalytics = useCallback(async () => {
  if (!profile?.school_id) return;  // ✓ Has check

  try {
    setLoading(true);

    // ❌ But profile could become null while this async operation is pending
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', profile.user_id)  // ❌ profile.user_id could be undefined
      .single();

    if (teacherData) {
      const { data: timetableData } = await supabase
        .from('timetable')
        .select('class_id')
        .eq('teacher_id', teacherData.id);
      
      // ... more queries
    }
  } catch (error) {
    // Error swallowed but state might be corrupted
  }
}, [profile?.school_id, profile?.role, profile?.user_id, ...]);
```

---

## 4. HIGH - useAuth Hook Profile Subscription Not Cleaned Up On Logout

**File**: [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx)

### Issue 4a: Profile Subscription Persists After Logout
**Location**: Lines 84-230

```tsx
useEffect(() => {
  // ... auth state listener setup

  let profileSubscription: any = null;
  
  const setupProfileSubscription = (userId: string) => {
    try {
      const channel = supabase.channel('profile-and-role-changes');
      
      // Subscribe to profile changes
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('User profile change detected:', payload);
          // ❌ This callback still fires even after logout
          if (user?.id) {  // Stale closure - user might not match actual state
            fetchProfile(userId);  // Tries to fetch with potentially invalid session
          }
        }
      );
      
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.warn('Profile subscription status:', status);
        }
      });
      
      profileSubscription = channel;
    } catch (error) {
      console.error('Error setting up profile subscription:', error);
    }
  };

  if (user?.id) {
    setupProfileSubscription(user.id);
  }

  return () => {
    subscription.unsubscribe();
    if (profileSubscription) {
      supabase.removeChannel(profileSubscription);
    }
  };
}, [user?.id]);  // ⚠️ Depends on user?.id
```

**Problem**:
- When logout happens, `setUser(null)` is called in `signOut()`
- But the cleanup function for the subscription hasn't run yet
- The callback `channel.on()` still has a reference to old user
- If database changes profile before cleanup runs, callback fires with old user reference
- Tries to call `fetchProfile(userId)` with no valid session

**Line 42-72**: `fetchProfile()` function:
```tsx
const fetchProfile = async (userId: string) => {
  if (!userId) return;  // ✓ Has guard

  try {
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);  // ❌ Error after logout
      return;
    }
    
    // More queries...
  } catch (error) {
    console.error('Error in fetchProfile:', error);
  }
};
```

---

## 5. CRITICAL - Components with Unprotected Subscriptions (List)

The following components have **real-time subscriptions without proper auth guards** and will continue firing after logout:

| Component | File | Lines | Issue |
|-----------|------|-------|-------|
| **SuperAdminDashboard** | `src/components/SuperAdminDashboard.tsx` | 103-143 | Subscriptions fire after logout, call fetchDashboardData() |
| **StudentManagement** | `src/components/StudentManagement.tsx` | 175-215 | Stale closures capture old profile reference |
| **ClassManagement** | `src/components/ClassManagement.tsx` | 93-150 | Queries made without session validation |
| **TeacherManagement** | `src/components/TeacherManagement.tsx` | 74-110 | Subscriptions not cleaned up properly |
| **UserManagement** | `src/components/UserManagement.tsx` | 47-80 | Real-time callbacks after logout |
| **SchoolAdminManagement** | `src/components/SchoolAdminManagement.tsx` | 43-70 | Missing logout guards in subscriptions |
| **ExamManagement** | `src/components/ExamManagement.tsx` | 106-125 | Multiple unprotected subscriptions |
| **TimetableManagement** | `src/components/TimetableManagement.tsx` | 84-120 | Queries with potentially null session |
| **SchoolManagement** | `src/components/SchoolManagement.tsx` | 66-120 | Async operations after logout |
| **SystemSettings** | `src/components/SystemSettings.tsx` | 95-150 | Subscriptions continue after logout |
| **ReportsAnalytics** | `src/components/ReportsAnalytics.tsx` | 98-150 | Multiple useEffects without profile checks |
| **AttendanceManagement** | `src/components/AttendanceManagement.tsx` | 62-100 | Subscriptions and queries unguarded |
| **ExamMarksEntry** | `src/components/ExamMarksEntry.tsx` | 62-150 | Real-time updates after logout |
| **SchoolAdminDashboard** | `src/components/SchoolAdminDashboard.tsx` | 98-200 | Subscriptions with stale closures |
| **TeacherDashboard** | `src/components/TeacherDashboard.tsx` | 258-290 | Multiple subscriptions unprotected |

---

## 6. MEDIUM - BootstrapChecker RPC Call After Logout

**File**: [src/components/BootstrapChecker.tsx](src/components/BootstrapChecker.tsx)

### Issue 6a: RPC Call During Logout Redirect
**Location**: Lines 16-45

```tsx
useEffect(() => {
  const checkBootstrapStatus = async () => {
    try {
      // ✓ Better - has user check
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .rpc('super_admin_exists');  // ❌ RPC call might fail if session becoming invalid

      if (error) {
        console.error('Error checking super admins:', error);
        setNeedsBootstrap(false);
      } else {
        setNeedsBootstrap(!data);
      }
    } catch (error) {
      console.error('Error checking bootstrap status:', error);
      setNeedsBootstrap(false);
    } finally {
      setLoading(false);
    }
  };

  checkBootstrapStatus();
}, [user]);  // ✓ Depends on user - good
```

**Problem** (Race Condition):
- User is rendering `/dashboard` 
- Logout happens, `user` becomes null
- BootstrapChecker sees `user` is null, skips RPC
- BUT: RPC call from previous render might still be pending
- Previous call resolves with invalid session → error

---

## 7. MEDIUM - Route Redirect Race Condition

**File**: [src/pages/Index.tsx](src/pages/Index.tsx)

### Issue 7a: Components Mount Before Redirect
**Location**: Lines 1-50

```tsx
const Index = () => {
  const { user, profile, loading } = useAuth();
  const { canAccessModule } = useModuleAccess();
  const [activeModule, setActiveModule] = useState('dashboard');

  // ✓ Has guard
  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <ModuleLoadingSkeleton />;
  }

  // ❌ renderContent() components mount here
  const renderContent = () => {
    if (profile?.role === 'super_admin') {
      switch (activeModule) {
        case 'students': return <StudentManagement />;  // ❌ Mounts before redirect happens
        case 'schools': return <SchoolManagement />;
        // ...
      }
    }
  };

  return (
    <Layout sidebar={<AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />}>
      <Dashboard>{renderContent()}</Dashboard>
    </Layout>
  );
};
```

**Race Condition**:
1. User logged in, viewing `/dashboard`
2. User clicks "Sign Out" in AppSidebar
3. `signOut()` executes, sets `user = null`
4. Index component re-renders
5. React hasn't unmounted `<StudentManagement />` yet
6. StudentManagement's real-time listener fires from database change
7. Callback tries to access `profile?.school_id` (now null)
8. Query with invalid session starts
9. Navigate to "/" starts
10. **If query completes with error before unmount:** ErrorBoundary catches it

---

## 8. MEDIUM - AppSidebar Logout Timing

**File**: [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)

### Issue 8a: signOut() Not Awaited Properly
**Location**: Lines 150-170

```tsx
<SidebarMenuButton
  onClick={async () => {
    await signOut();  // ✓ Awaited
  }}
  className="h-10 px-3 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
>
  <LogOut className="h-4 w-4" />
  <span>Sign Out</span>
</SidebarMenuButton>
```

**Problem** (Minor):
- `await signOut()` ensures `user`, `profile`, `session` are cleared
- But doesn't wait for component unmounting
- Real-time listeners might still fire during unmount
- If listener callback is in progress, it might execute after logout

---

## 9. LOW - ErrorBoundary Display

**File**: [src/components/ErrorBoundary.tsx](src/components/ErrorBoundary.tsx)

### ErrorBoundary Correctly Catches Errors But Shows Generic Message
**Location**: Lines 30-40

```tsx
render() {
  if (this.state.hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-2xl w-full">
          <div className="rounded-lg border bg-card text-card-foreground shadow-lg">
            <div className="flex flex-col space-y-6 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-destructive/10 p-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Something went wrong  {/* ← THIS MESSAGE USER SEES */}
                  </h1>
```

**What triggers this**:
- Any JavaScript error thrown during render
- Async errors that propagate to component render
- Unhandled Promise rejections in effects (sometimes)

---

## 10. LOW - Window/Browser API Errors During Logout

**Potential Issues**:
- `window.location.origin` accessed when in redirect
- `localStorage` accessed with invalid auth
- `fetch()` calls to APIs without session

---

## 11. LANDING PAGE SAFETY CHECK

**File**: [src/pages/Landing.tsx](src/pages/Landing.tsx)

### ✅ SAFE - No useAuth() Calls
**Location**: Lines 1-100

```tsx
const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();  // ✓ Simple toast, no auth
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [salesForm, setSalesForm] = useState({...});  // ✓ Local state only
  
  // ✅ NO useAuth() call
  // ✅ NO Supabase queries
  // ✅ NO real-time subscriptions
  // ✅ SAFE - pure presentation component
```

---

## SUMMARY - Error Sources During Logout

| Priority | Component | Issue | Error Type |
|----------|-----------|-------|-----------|
| 🔴 CRITICAL | SuperAdminDashboard | Subscriptions fire after logout | Supabase query with invalid session |
| 🔴 CRITICAL | StudentManagement | Stale closures in callbacks | Null reference + invalid session |
| 🔴 CRITICAL | useAuth hook | Profile subscription persists | Callback fires after logout |
| 🔴 CRITICAL | 13 other components | Unprotected subscriptions | Real-time callbacks after logout |
| 🟠 MEDIUM | BootstrapChecker | RPC call race condition | Pending call completes after logout |
| 🟠 MEDIUM | Index.tsx | Component mount/unmount race | Subscriber fires before unmount |
| 🟡 LOW | AppSidebar | Async signOut timing | Minor race condition |
| 🟡 LOW | Multiple | Stale closures in effects | Old profile/user references |

---

## ROOT CAUSE ANALYSIS

**Why Each Error Occurs**:

### 1. Subscription Callbacks Outlive Session
- Real-time listeners are set up with `.subscribe()`
- They're NOT cleaned up when user logs out
- When database changes, callbacks fire
- Callbacks try to access `profile`/`user` which are now null
- Queries made with null session → Supabase error

### 2. Stale Closures in Callbacks
- `useEffect` callbacks capture current value of `profile`
- When profile becomes null, old callback still runs
- Tries to use old `profile.school_id` that no longer exists
- Leads to undefined behavior

### 3. Async Operations Pending During Logout
- `fetchData()` called, returns Promise
- User logs out before Promise resolves
- Promise resolves with old `profile` reference
- Tries to set state on unmounted component OR
- Tries to make query with invalid session

### 4. No Auth Validation in Async Callbacks
- Most components don't check if `user` still exists before executing
- They check if `profile?.school_id` exists
- But don't validate if session is still active
- Leads to queries with cleared session

---

## RECOMMENDATION - How to Fix

1. **Add user existence checks before all queries** in subscriptions
2. **Clean up subscriptions when user becomes null**
3. **Use proper dependency arrays** with `user` included
4. **Validate session before making queries** in callbacks
5. **Use AbortController** to cancel pending requests on logout
6. **Add loading state during redirect** to prevent component mounting

---

## Testing Logout Flow

To reproduce these errors:
1. Log in as any user
2. Navigate to `/dashboard`
3. Open browser DevTools → Network tab
4. Select a module (e.g., Students)
5. Immediately click "Sign Out"
6. Check console for errors
7. Look for "Something went wrong" ErrorBoundary message
8. Observe which Supabase call failed

---

## Files with Issues - Full Reference

**Priority 1 (Fix Immediately)**:
- [src/components/SuperAdminDashboard.tsx](src/components/SuperAdminDashboard.tsx) - Lines 103-200
- [src/components/StudentManagement.tsx](src/components/StudentManagement.tsx) - Lines 168-215
- [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx) - Lines 84-230

**Priority 2 (Fix Soon)**:
- [src/components/ClassPerformanceAnalytics.tsx](src/components/ClassPerformanceAnalytics.tsx) - Lines 69-264
- [src/components/ClassManagement.tsx](src/components/ClassManagement.tsx) - Lines 93-150
- [src/components/TeacherManagement.tsx](src/components/TeacherManagement.tsx) - Lines 74-110
- [src/components/UserManagement.tsx](src/components/UserManagement.tsx) - Lines 47-80

**Priority 3 (Fix Later)**:
- [src/components/SchoolAdminManagement.tsx](src/components/SchoolAdminManagement.tsx) - Lines 43-70
- [src/components/ExamManagement.tsx](src/components/ExamManagement.tsx) - Lines 106-125
- [src/components/TimetableManagement.tsx](src/components/TimetableManagement.tsx) - Lines 84-120
- [src/components/SchoolManagement.tsx](src/components/SchoolManagement.tsx) - Lines 66-120
- [src/components/SystemSettings.tsx](src/components/SystemSettings.tsx) - Lines 95-150
- [src/components/ReportsAnalytics.tsx](src/components/ReportsAnalytics.tsx) - Lines 98-150
- [src/components/AttendanceManagement.tsx](src/components/AttendanceManagement.tsx) - Lines 62-100
- [src/components/ExamMarksEntry.tsx](src/components/ExamMarksEntry.tsx) - Lines 62-150
- [src/components/SchoolAdminDashboard.tsx](src/components/SchoolAdminDashboard.tsx) - Lines 98-200
- [src/components/TeacherDashboard.tsx](src/components/TeacherDashboard.tsx) - Lines 258-290

---

## Related Documentation

- ERROR_ANALYSIS_REPORT.md - Previous logout analysis
- ROUTE_PROTECTION_COMPLETION_REPORT.md - Route guards
- E2E_TESTING_PLAN.md - Testing procedures
