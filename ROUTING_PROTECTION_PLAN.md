# Comprehensive Routing Protection Plan

## Overview
This document maps all routes in the application to required features and access levels, organized by category and role access.

---

## 1. PUBLIC ROUTES (No Protection Required)

| Route Path | Component | Purpose | Access | Notes |
|-----------|-----------|---------|--------|-------|
| `/` | Landing | Public landing page | All (unauthenticated) | No auth required |
| `/auth` | Auth | Login/signup page | All (unauthenticated) | Portal for all roles |
| `/bootstrap` | Bootstrap | Initial setup/bootstrap | All | System initialization |
| `/school-registration` | SchoolRegistration | School registration form | All (unauthenticated) | New school onboarding |
| `/reset-password` | PasswordReset | Password recovery | All (unauthenticated) | Self-service password reset |
| `*` | NotFound | 404 page | All | Invalid route fallback |

---

## 2. AUTHENTICATION ROUTES (Require Login, No Feature Check)

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority | Notes |
|-----------|-----------|---------|------------|-----------------|----------|-------|
| `/teacher-portal` | TeacherPortalEntry | roles: teacher | Full | Teachers only | HIGH | Auto-login portal, needs role guard |
| `/system-admin-access` | AdminAuth | roles: super_admin | Full | Super admin only | CRITICAL | Restricted system admin access gate |

**Protection Method:** `ProtectedRoute` with `roles` parameter (no feature check needed)

---

## 3. MAIN DASHBOARD ROUTE (Protected)

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority | Notes |
|-----------|-----------|---------|------------|-----------------|----------|-------|
| `/dashboard` | BootstrapChecker→Index | Varies by module | Varies | All authenticated users | CRITICAL | Entry point, role-based module rendering |

**Protection:** Already wrapped in BootstrapChecker & AuthProvider

---

## 4. SUPER ADMIN ROUTES (via /dashboard activeModule)

### 4.1 User & System Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=users` | SchoolAdminManagement | `school_admins.view` | read-only | Super admin | HIGH |
| | | `school_admins.create` | full | Super admin | HIGH |
| | | `school_admins.edit` | full | Super admin | HIGH |
| | | `school_admins.delete` | full | Super admin | HIGH |
| | | `school_admins.approve` | full | Super admin | HIGH |
| | | `school_admins.reject` | full | Super admin | HIGH |
| `/dashboard?module=settings` | Settings | `system_settings.manage` | full | Super admin | CRITICAL |
| | | `security.manage` | full | Super admin | CRITICAL |

### 4.2 School & Organization Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=schools` | SchoolManagement | `schools.view` | read-only | Super admin | HIGH |
| | | `schools.edit` | full | Super admin | HIGH |
| `/dashboard?module=students` | StudentManagement | `students.view` | read-only | Super admin | MEDIUM |

### 4.3 Analytics & Monitoring

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=dashboard` | SuperAdminDashboard | `analytics.view` | full | Super admin | HIGH |
| | | `audit_logs.view` | full | Super admin | CRITICAL |
| | | `reports.view` | full | Super admin | MEDIUM |

---

## 5. SCHOOL ADMIN ROUTES (via /dashboard activeModule)

### 5.1 Student Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=students` | StudentManagement | `students.view` | full | School admin | HIGH |
| | | `students.create` | full | School admin | HIGH |
| | | `students.edit` | full | School admin | HIGH |
| | | `students.delete` | full | School admin | HIGH |
| | | `students.enroll` | full | School admin | HIGH |
| | | `students.export` | full | School admin | MEDIUM |

### 5.2 Teacher & User Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=users` | TeacherManagement | `teachers.view` | full | School admin | HIGH |
| | | `teachers.create` | full | School admin | HIGH |
| | | `teachers.edit` | full | School admin | HIGH |
| | | `teachers.delete` | full | School admin | HIGH |
| | | `teachers.approve` | full | School admin | HIGH |
| | | `teachers.reject` | full | School admin | HIGH |
| | | `teachers.assign_classes` | full | School admin | HIGH |

### 5.3 Class Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=classes` | ClassManagement | `classes.view` | full | School admin | HIGH |
| | | `classes.create` | full | School admin | HIGH |
| | | `classes.edit` | full | School admin | HIGH |
| | | `classes.delete` | full | School admin | HIGH |

### 5.4 Subject Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=subjects` | SubjectManagement | `subjects.view` | full | School admin | HIGH |
| | | `subjects.create` | full | School admin | HIGH |
| | | `subjects.edit` | full | School admin | HIGH |
| | | `subjects.delete` | full | School admin | HIGH |

### 5.5 Advanced Features

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=attendance` | AttendanceManagement | `attendance.view` | full | School admin | HIGH |
| | | `attendance.approve` | full | School admin | HIGH |
| | | `attendance.export` | full | School admin | MEDIUM |
| `/dashboard?module=exams` | ExamManagement | `exams.view` | full | School admin | HIGH |
| | | `exams.create` | full | School admin | HIGH |
| | | `exams.edit` | full | School admin | HIGH |
| | | `exams.manage` | full | School admin | HIGH |
| | | `marks.view` | full | School admin | HIGH |
| | | `marks.approve` | full | School admin | HIGH |
| | | `marks.export` | full | School admin | MEDIUM |
| `/dashboard?module=timetable` | TimetableManagement | `timetable.view` | full | School admin | HIGH |
| | | `timetable.create` | full | School admin | HIGH |
| | | `timetable.edit` | full | School admin | HIGH |
| | | `timetable.manage` | full | School admin | HIGH |

### 5.6 Class Assignment & Reports

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=class-assignment` | ClassAssignment | `teachers.assign_classes` | full | School admin | MEDIUM |
| `/dashboard?module=reports` | ReportsAnalytics | `reports.view` | full | School admin | MEDIUM |
| | | `reports.create` | full | School admin | MEDIUM |
| | | `reports.export` | full | School admin | MEDIUM |
| | | `analytics.view` | full | School admin | MEDIUM |
| | | `analytics.export` | full | School admin | MEDIUM |

### 5.7 School Settings

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=settings` | Settings | `settings.school` | full | School admin | HIGH |
| | | `settings.notification` | full | School admin | MEDIUM |
| | | `settings.security` | full | School admin | HIGH |

---

## 6. TEACHER ROUTES (via /dashboard activeModule)

### 6.1 Core Teaching Functions

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=attendance` | AttendanceManagement | `attendance.view` | full | Teacher | CRITICAL |
| | | `attendance.record` | full | Teacher | CRITICAL |
| | | `attendance.export` | full | Teacher | HIGH |
| | | `attendance.bulk_edit` | full | Teacher | HIGH |
| `/dashboard?module=exam-marks` | ExamMarksEntry | `exams.view` | full | Teacher | CRITICAL |
| | | `exams.create` | full | Teacher | HIGH |
| | | `exams.by_subject` | full | Teacher | HIGH |
| | | `marks.enter` | full | Teacher | CRITICAL |
| | | `marks.view` | full | Teacher | HIGH |
| | | `marks.export` | full | Teacher | HIGH |
| | | `marks.bulk_import` | full | Teacher | MEDIUM |

### 6.2 Class & Subject Management

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=classes` | ClassManagement | `classes.view` | full | Teacher | HIGH |
| | | `classes.my_classes` | full | Teacher | HIGH |
| `/dashboard?module=subjects` | SubjectManagement | `subjects.view` | read-only | Teacher | MEDIUM |

### 6.3 Data Access & Timetable

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=students` | StudentManagement | `students.view` | read-only | Teacher | MEDIUM |
| `/dashboard?module=exams` | ExamManagement | `exams.view` | full | Teacher | HIGH |
| `/dashboard?module=timetable` | TimetableManagement | `timetable.view` | full | Teacher | HIGH |

### 6.4 Analytics & Reports

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=reports` | ReportsAnalytics | `reports.view` | full | Teacher | MEDIUM |
| | | `reports.create` | full | Teacher | MEDIUM |
| | | `reports.export` | full | Teacher | MEDIUM |
| | | `reports.performance` | full | Teacher | MEDIUM |
| | | `reports.student_feedback` | full | Teacher | MEDIUM |
| | | `analytics.view` | full | Teacher | MEDIUM |
| | | `analytics.by_class` | full | Teacher | MEDIUM |
| | | `analytics.by_subject` | full | Teacher | MEDIUM |
| | | `analytics.export` | full | Teacher | MEDIUM |
| `/dashboard?module=dashboard` | TeacherDashboard | `quick_attendance.access` | full | Teacher | HIGH |
| | | `quick_attendance.mark` | full | Teacher | HIGH |

---

## 7. STUDENT ROUTES (via /dashboard activeModule)

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority |
|-----------|-----------|---------|------------|-----------------|----------|
| `/dashboard?module=dashboard` | Dashboard | `analytics.view_own` | full | Student | HIGH |
| | | `analytics.personal_progress` | full | Student | HIGH |
| `/dashboard?module=classes` | ClassManagement | `classes.view` | full | Student | MEDIUM |
| | | `classes.my_schedule` | full | Student | MEDIUM |
| `/dashboard?module=subjects` | SubjectManagement | `subjects.view` | read-only | Student | MEDIUM |
| | | `exams.view` | full | Student | HIGH |
| | | `exams.view_own_results` | full | Student | HIGH |
| | | `marks.view_own` | full | Student | HIGH |
| | | `timetable.view` | full | Student | HIGH |
| | | `timetable.my_schedule` | full | Student | HIGH |
| | | `attendance.view_own` | full | Student | MEDIUM |
| | | `attendance.view_records` | read-only | Student | MEDIUM |
| | | `reports.view_own` | full | Student | MEDIUM |
| | | `reports.personal_performance` | full | Student | MEDIUM |
| | | `reports.progress_report` | full | Student | MEDIUM |

---

## 8. DEVELOPMENT/DEBUG ROUTES (Dev Environment Only)

| Route Path | Component | Feature | AccessLevel | Who Can Access | Priority | Notes |
|-----------|-----------|---------|------------|-----------------|----------|-------|
| `/config-debug` | ConfigDebugger | N/A | N/A | Dev env only | LOW | Environment config debug |
| `/test` | TestPage | N/A | N/A | Dev env only | LOW | Generic test page |
| `/supabase-test` | SupabaseConnectionTest | N/A | N/A | Dev env only | LOW | DB connection test |
| `/realtime-test` | RealtimeTest | N/A | N/A | Dev env only | LOW | Realtime feature test |
| `/supabase-test-suite` | SupabaseTestSuite | N/A | N/A | Dev env only | LOW | Full test suite |

**Status:** Already protected by `import.meta.env.DEV` check in App.tsx

---

## 9. PROTECTION MATRIX BY ROUTE LEVEL

### Top-Level Routes (App.tsx)

```
PUBLIC ROUTES (No Protection Needed)
├── /
├── /auth
├── /bootstrap
├── /school-registration
├── /reset-password

PROTECTED ROUTES (Need Role or Feature Guard)
├── /dashboard → RequiresAuth only
├── /teacher-portal → RequiresAuth + Role(teacher)
├── /system-admin-access → RequiresAuth + Role(super_admin)

DEBUG ROUTES (Dev only, already protected)
├── /config-debug
├── /supabase-test
├── /realtime-test
├── /test
├── /supabase-test-suite
```

### Dashboard Modules (Index.tsx)

```
currentModule State-Based Routing (All require /dashboard auth)

SUPER_ADMIN Modules
├── dashboard → SuperAdminDashboard (analytics.view full)
├── students → StudentManagement (students.view read-only)
├── schools → SchoolManagement (schools.view full)
├── users → SchoolAdminManagement (school_admins.view full)
└── settings → Settings (system_settings.manage full)

SCHOOL_ADMIN Modules
├── dashboard → SchoolAdminDashboard (analytics.view full)
├── students → StudentManagement (students.view full)
├── classes → ClassManagement (classes.view full)
├── subjects → SubjectManagement (subjects.view full)
├── attendance → AttendanceManagement (attendance.view full)
├── exams → ExamManagement (exams.view full)
├── timetable → TimetableManagement (timetable.view full)
├── users → TeacherManagement (teachers.view full)
├── reports → ReportsAnalytics (reports.view full)
├── class-assignment → ClassAssignment (teachers.assign_classes full)
└── settings → Settings (settings.school full)

TEACHER Modules
├── dashboard → TeacherDashboard (quick_attendance.access full)
├── students → StudentManagement (students.view read-only)
├── subjects → SubjectManagement (subjects.view read-only)
├── attendance → AttendanceManagement (attendance.record full)
├── exam-marks → ExamMarksEntry (marks.enter full)
├── exams → ExamManagement (exams.view full)
├── timetable → TimetableManagement (timetable.view full)
└── classes → ClassManagement (classes.view full)

STUDENT Modules
├── dashboard → Dashboard (analytics.view_own full)
├── classes → ClassManagement (classes.view full)
└── subjects → SubjectManagement (subjects.view read-only)
```

---

## 10. RECOMMENDATIONS & ACTION ITEMS

### 🔴 CRITICAL ISSUES

1. **No Route-Level Feature Guards in App.tsx**
   - `/teacher-portal` should have ProtectedRoute wrapper with roles=['teacher']
   - `/system-admin-access` should have ProtectedRoute wrapper with roles=['super_admin']
   - `/dashboard` has basic auth but needs feature verification

2. **Dashboard Modules Not Protected by Features**
   - setActiveModule() is called without feature checks
   - A user could theoretically navigate to restricted modules
   - AppSidebar filters visibility but doesn't prevent direct module access
   - Need feature guards on module rendering in Index.tsx renderContent()

3. **No Fallback Redirect Paths**
   - ProtectedRoute components should specify redirectTo prop
   - Currently defaults to '/dashboard' - should be context-aware

### 🟡 HIGH PRIORITY

1. **Wrap App.tsx Routes with ProtectedRoute**
   ```tsx
   <Route path="/teacher-portal" element={
     <ProtectedRoute roles="teacher" redirectTo="/auth">
       <TeacherPortalEntry />
     </ProtectedRoute>
   } />
   ```

2. **Add Feature Guards to Index.tsx Module Rendering**
   ```tsx
   const can = useFeatureAccess();
   
   if (activeModule === 'schools' && !can('schools.view')) {
     return <Navigate to="/dashboard" replace />;
   }
   ```

3. **Implement Module Access Control Matrix in Index.tsx**
   - Define allowed modules per role
   - Check feature before rendering each module
   - Return UnauthorizedPage if module not allowed

### 🟢 MEDIUM PRIORITY

1. **Create Unauthorized Component**
   - Display when feature/role check fails
   - Show reason for denial
   - Provide navigation options

2. **Add Module Type Guards**
   - Type-safe module selection
   - Prevent invalid module names
   - Better IDE autocomplete

3. **Audit Log Access Restrictions**
   - Only super_admin can view audit_logs
   - Add feature guard to audit log viewer
   - Monitor access attempts

### 📋 BEST PRACTICES

1. **Feature Matrix Usage**
   - Prefer `ProtectedRoute` over inline role checks
   - Use features from access-control.ts constants
   - Always specify requiredLevel parameter

2. **Error Handling**
   - Show friendly "Access Denied" messages
   - Don't expose why access was denied (security)
   - Log denial attempts for audit

3. **Testing Strategy**
   - Test each route with different user roles
   - Verify redirects work correctly
   - Check feature matrix alignment

---

## 11. FALLBACK REDIRECT MAP

| Route Category | Primary Redirect | Secondary Redirect | Notes |
|---------------|------------------|-------------------|-------|
| Admin routes | `/dashboard` | `/auth` | If not super_admin |
| School admin routes | `/dashboard` | `/auth` | If not school_admin |
| Teacher routes | `/dashboard` | `/auth` | If not teacher |
| Student routes | `/dashboard` | `/auth` | If not student |
| Unauthenticated | `/auth` | `/` | Always for protected routes |
| Dev/Debug routes | `/dashboard` | `/` | If not in DEV environment |

---

## 12. IMPLEMENTATION CHECKLIST

- [ ] Update App.tsx to wrap /teacher-portal with ProtectedRoute(roles=['teacher'])
- [ ] Update App.tsx to wrap /system-admin-access with ProtectedRoute(roles=['super_admin'])
- [ ] Create module access control matrix in Index.tsx
- [ ] Add feature checks before rendering each module in renderContent()
- [ ] Create UnauthorizedPage component for access denied scenarios
- [ ] Add audit logging for failed access attempts (super_admin only)
- [ ] Update navigation guards to prevent direct module access
- [ ] Test all routes with each user role
- [ ] Document final routing structure
- [ ] Add JSDoc comments to route-related functions
- [ ] Implement feature-based breadcrumb filtering

---

## 13. FEATURE GROUPS SUMMARY

**Admin-Only Features:**
- `schools.*` (create, edit, delete)
- `school_admins.*` (all)
- `system_settings.manage`
- `security.manage`
- `audit_logs.view`

**School Admin-Only Features:**
- `teachers.*` (create, edit, delete, approve, reject)
- `students.*` (enroll, export)
- `classes.*` (create, edit, delete)
- `subjects.*` (create, edit, delete)
- `attendance.approve`
- `marks.approve`
- `timetable.manage`

**Teacher-Only Features:**
- `attendance.record` (full)
- `marks.enter` (full)
- `marks.bulk_import`
- `quick_attendance.*`

**Cross-Role Features:**
- `.view` and `read-only` permissions
- `.analytics.view` and `.export`
- `reports.*`
- `.settings.profile` and `.notification_preference`

