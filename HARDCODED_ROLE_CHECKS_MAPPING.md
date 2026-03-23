# Comprehensive Hardcoded Role Checks to RBAC Mapping

## Overview
This document maps all hardcoded role checks to their corresponding RBAC features. Use this for batch replacement of all hardcoded `profile?.role` checks with the `useFeatureAccess()` hook.

---

## Master Mapping Table

| Component | Line | Current Pattern | Feature | Access Level | Replacement Hook Call |
|-----------|------|-----------------|---------|--------------|----------------------|
| AttendanceManagement.tsx | 85 | `if (profile?.role === 'teacher')` | `attendance.record` | full | `const { canFull } = useFeatureAccess(); if (canFull('attendance.record'))` |
| AttendanceManagement.tsx | 75-80 | Load classes query based on role | `attendance.view` | full | `const { can } = useFeatureAccess(); if (can('attendance.view', 'full'))` |
| ClassManagement.tsx | 73 | `const isAdmin = profile?.role === 'school_admin' \|\| profile?.role === 'super_admin';` | `classes.create` | full | `const { canFull } = useFeatureAccess(); const isAdmin = canFull('classes.create');` |
| ClassPerformanceAnalytics.tsx | 75 | `if (profile.role === 'teacher')` | `analytics.by_class` | full | `const { canFull } = useFeatureAccess(); if (canFull('analytics.by_class'))` |
| ClassPerformanceAnalytics.tsx | 95 | `profile.role === 'teacher'` | `classes.my_classes` | full | `const { canFull } = useFeatureAccess(); if (canFull('classes.my_classes'))` |
| ClassPerformanceAnalytics.tsx | 99 | `profile.role === 'teacher'` | `analytics.by_class` | full | `const { canFull } = useFeatureAccess(); targetClassIds = canFull('analytics.by_class') ? teacherClassIds : [];` |
| ClassPerformanceAnalytics.tsx | 319 | `profile?.role === 'teacher'` | `analytics.view` | read-only | `const { can } = useFeatureAccess(); const isTeacher = is('teacher');` (or use `can('analytics.view', 'read-only')`) |
| SchoolManagement.tsx | 65 | `if (profile?.role === 'super_admin')` | `schools.view` | full | `const { canFull } = useFeatureAccess(); if (canFull('schools.view'))` |
| SchoolManagement.tsx | 63-70 | Conditional fetch in useEffect | `schools.view` | full | `const { can } = useFeatureAccess(); if (can('schools.view'))` |
| SystemSettings.tsx | 61 | `if (profile?.role === 'super_admin')` | `system_settings.manage` | full | `const { canFull } = useFeatureAccess(); if (canFull('system_settings.manage'))` |
| SystemSettings.tsx | 42-44 | useEffect conditional based on role | `system_settings.manage` | full | `const { canFull } = useFeatureAccess(); if (canFull('system_settings.manage'))` |
| TeacherManagement.tsx | 111 | `if (profile?.role === 'school_admin' && profile?.school_id)` | `teachers.view` | full | `const { canFull } = useFeatureAccess(); if (canFull('teachers.view'))` |
| SubjectManagement.tsx | 94 | `if (profile?.role === 'super_admin')` | `subjects.view` | full | `const { canFull } = useFeatureAccess(); if (canFull('subjects.view'))` |
| SubjectManagement.tsx | 106 | `else if (profile?.school_id)` | `subjects.view` | full | `const { can } = useFeatureAccess(); if (can('subjects.view'))` |
| SubjectManagement.tsx | 117 | `if (profile?.role === 'super_admin')` | `subjects.view` | full | `const { canFull } = useFeatureAccess(); if (canFull('subjects.view'))` |
| SubjectManagement.tsx | 190 | `if (profile?.role === 'teacher')` | `subjects.assign` | full | `const { canFull } = useFeatureAccess(); if (canFull('subjects.assign'))` |
| SubjectManagement.tsx | 337 | `profile?.role === 'super_admin'` | `subjects.create` | full | `const { canFull } = useFeatureAccess(); !canFull('subjects.create') && selectedSchoolId` |
| SubjectManagement.tsx | 340 | `profile?.role !== 'teacher'` | `subjects.create` | full | `const { canFull } = useFeatureAccess(); canFull('subjects.create') &&` |
| SubjectManagement.tsx | 349 | `profile?.role === 'teacher'` | `subjects.assign` | full | `const { canFull } = useFeatureAccess(); canFull('subjects.assign') ?` |
| SubjectManagement.tsx | 358 | `profile?.role === 'teacher'` | `subjects.assign` | full | `const { canFull } = useFeatureAccess(); canFull('subjects.assign') ? 'My Subjects' :` |
| SubjectManagement.tsx | 450 | `profile?.role === 'super_admin'` | `subjects.create` | full | `const { canFull } = useFeatureAccess(); profile?.role === 'super_admin' && !selectedSchoolId` |
| SubjectManagement.tsx | 454 | `profile?.role === 'super_admin'` | `subjects.view` | read-only | `const { can } = useFeatureAccess(); !can('subjects.view') && !selectedSchoolId` |
| SubjectManagement.tsx | 467 | `profile?.role === 'teacher'` | `subjects.assign` | full | `const { canFull } = useFeatureAccess(); canFull('subjects.assign') ? 'My Subjects' :` |
| TimetableManagement.tsx | 94 | `if (profile?.role === 'teacher')` | `timetable.view` | full | `const { canFull } = useFeatureAccess(); if (canFull('timetable.view'))` |
| TimetableManagement.tsx | 114 | `if (profile?.role === 'teacher')` | `timetable.view` | full | `const { canFull } = useFeatureAccess(); if (canFull('timetable.view'))` |
| TimetableManagement.tsx | 587 | `profile?.role === 'teacher'` | `timetable.view` | full | `const { canFull } = useFeatureAccess(); profile?.role === 'teacher'` → use `canFull('timetable.manage')` or `!canFull('timetable.manage')` |
| TimetableManagement.tsx | 589 | `profile?.role === 'teacher'` | `timetable.view` | full | `const { canFull } = useFeatureAccess(); !canFull('timetable.manage')` |
| TimetableManagement.tsx | 596 | `profile?.role === 'teacher'` | `timetable.view` | full | `const { can } = useFeatureAccess(); !can('timetable.manage')` |
| TimetableManagement.tsx | 602 | `profile?.role === 'teacher'` | `timetable.view` | full | `const { can } = useFeatureAccess(); !can('timetable.manage')` |

---

## Detailed Replacements by Component

### 1. AttendanceManagement.tsx

**Line 85 - Class filtering for teachers:**
```typescript
// BEFORE:
if (profile?.role === 'teacher') {
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', profile.user_id)
    .single();
  // ...
}

// AFTER:
const { canFull } = useFeatureAccess();
if (canFull('attendance.record')) {
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', profile.user_id)
    .single();
  // ...
}
```

**Feature Mapping:**
- Current: Checks if user is teacher, then filters classes to only those they teach
- Mapped Feature: `attendance.record` (teachers can record attendance for their classes)
- Required Level: `full`

---

### 2. ClassManagement.tsx

**Line 73 - Admin check for CRUD operations:**
```typescript
// BEFORE:
const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin';

// AFTER:
const { canFull } = useFeatureAccess();
const isAdmin = canFull('classes.create');
```

**Feature Mapping:**
- Current: Checks if user is admin to show create/edit/delete buttons
- Mapped Features: `classes.create` for admin functionality
- Required Level: `full`

---

### 3. ClassPerformanceAnalytics.tsx

**Line 75 - Teacher-specific analytics loading:**
```typescript
// BEFORE:
if (profile.role === 'teacher') {
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', profile.user_id)
    .single();
  // ...
}

// AFTER:
const { canFull } = useFeatureAccess();
if (canFull('analytics.by_class')) {
  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', profile.user_id)
    .single();
  // ...
}
```

**Line 95 & 99 - Target class IDs determination:**
```typescript
// BEFORE:
const targetClassIds = classId 
  ? [classId] 
  : profile.role === 'teacher' 
  ? teacherClassIds 
  : [];

// AFTER:
const { canFull } = useFeatureAccess();
const targetClassIds = classId 
  ? [classId] 
  : canFull('classes.my_classes')
  ? teacherClassIds 
  : [];
```

**Line 319 - Conditional message display:**
```typescript
// BEFORE:
{profile?.role === 'teacher' 
  ? 'No students found in your assigned classes. Please check your timetable assignments.'
  : 'No students found. Add students to see performance analytics.'}

// AFTER:
const { can } = useFeatureAccess();
{can('analytics.view', 'read-only')
  && can('classes.my_classes')
  ? 'No students found in your assigned classes. Please check your timetable assignments.'
  : 'No students found. Add students to see performance analytics.'}
```

---

### 4. SchoolManagement.tsx

**Line 65 - Super admin check in useEffect:**
```typescript
// BEFORE:
useEffect(() => {
  if (profile?.role === 'super_admin') {
    fetchSchools();
  }
}, [profile]);

// AFTER:
const { canFull } = useFeatureAccess();
useEffect(() => {
  if (canFull('schools.view')) {
    fetchSchools();
  }
}, [profile]);
```

---

### 5. SystemSettings.tsx

**Line 61 - Super admin check:**
```typescript
// BEFORE:
if (profile?.role !== 'super_admin') {
  return (
    <div className="text-center py-8 lg:py-12 p-3 lg:p-6">
      <Shield className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="text-lg lg:text-xl font-semibold">Access Denied</h3>
      <p className="text-muted-foreground text-sm lg:text-base">Only super administrators can access system settings.</p>
    </div>
  );
}

// AFTER:
const { canFull } = useFeatureAccess();
if (!canFull('system_settings.manage')) {
  return (
    <div className="text-center py-8 lg:py-12 p-3 lg:p-6">
      <Shield className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="text-lg lg:text-xl font-semibold">Access Denied</h3>
      <p className="text-muted-foreground text-sm lg:text-base">Only super administrators can access system settings.</p>
    </div>
  );
}
```

---

### 6. TeacherManagement.tsx

**Line 111 - School admin filtering:**
```typescript
// BEFORE:
if (profile?.role === 'school_admin' && profile?.school_id) {
  query = query.eq('school_id', profile.school_id);
}

// AFTER:
const { canFull } = useFeatureAccess();
if (canFull('teachers.view') && profile?.school_id) {
  query = query.eq('school_id', profile.school_id);
}
```

---

### 7. SubjectManagement.tsx

**Multiple locations - Role-based UI and data access:**
```typescript
// Lines 94, 106, 117 - useEffect conditional loading
// BEFORE:
if (profile?.role === 'super_admin') {
  // Super admin needs to select a school first
  if (selectedSchoolId) {
    fetchSubjects();
  }
} else if (profile?.school_id) {
  setSelectedSchoolId(profile.school_id);
  fetchSubjects();
}

// AFTER:
const { canFull } = useFeatureAccess();
if (canFull('subjects.create')) { // Super admin check
  if (selectedSchoolId) {
    fetchSubjects();
  }
} else if (profile?.school_id) {
  setSelectedSchoolId(profile.school_id);
  fetchSubjects();
}

// Lines 337-358 - School selector visibility
// BEFORE:
{profile?.role !== 'teacher' && (
  <Button 
    className="bg-gradient-primary hover:opacity-90"
    onClick={() => setIsAddDialogOpen(true)}
    disabled={profile?.role === 'super_admin' && !selectedSchoolId}
  >
    <Plus className="h-4 w-4 mr-2" />
    Add New Subject
  </Button>
)}

// AFTER:
const { canFull } = useFeatureAccess();
{canFull('subjects.create') && (
  <Button 
    className="bg-gradient-primary hover:opacity-90"
    onClick={() => setIsAddDialogOpen(true)}
    disabled={!canFull('schools.view') && !selectedSchoolId}
  >
    <Plus className="h-4 w-4 mr-2" />
    Add New Subject
  </Button>
)}

// Lines 349-358 - Header text conditional
// BEFORE:
<h1 className="text-3xl font-bold text-foreground">
  {profile?.role === 'teacher' ? 'My Subjects' : 'Subject Management'}
</h1>

// AFTER:
const { canFull } = useFeatureAccess();
<h1 className="text-3xl font-bold text-foreground">
  {canFull('subjects.assign') && !canFull('subjects.create') ? 'My Subjects' : 'Subject Management'}
</h1>

// Lines 450-467 - Message display conditionals
// BEFORE:
{profile?.role === 'super_admin' && !selectedSchoolId
  ? 'Please select a school to view subjects.'
  : 'Get started by adding your first subject.'}

// AFTER:
const { canFull } = useFeatureAccess();
{!canFull('schools.view') && !selectedSchoolId
  ? 'Please select a school to view subjects.'
  : 'Get started by adding your first subject.'}
```

---

### 8. TimetableManagement.tsx

**Lines 94, 114 - Teacher schedule filtering:**
```typescript
// BEFORE:
if (profile?.role === 'teacher' && teacherRecord) {
  timetableQuery = timetableQuery.eq('teacher_id', teacherRecord.id);
}

// AFTER:
const { canFull } = useFeatureAccess();
if (canFull('timetable.manage') === false && teacherRecord) {
  // Teacher view - only show their own schedule
  timetableQuery = timetableQuery.eq('teacher_id', teacherRecord.id);
}
// OR more precisely:
const isTeacher = !canFull('timetable.manage') && can('timetable.view');
if (isTeacher && teacherRecord) {
  timetableQuery = timetableQuery.eq('teacher_id', teacherRecord.id);
}
```

**Lines 587-602 - Header and badge display:**
```typescript
// BEFORE:
<h1 className="text-xl lg:text-3xl font-bold text-foreground">
  {profile?.role === 'teacher' ? 'My Schedule' : 'Timetable Management'}
</h1>
{profile?.role === 'teacher' && (
  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
    Personal View
  </Badge>
)}
<p className="text-sm text-muted-foreground">
  {profile?.role === 'teacher' 
    ? 'View your teaching schedule and class assignments'
    : 'Manage class schedules and timetables with intelligent conflict detection'}
</p>
{profile?.role === 'teacher' && timetableEntries.length > 0 && (

// AFTER:
const { canFull } = useFeatureAccess();
<h1 className="text-xl lg:text-3xl font-bold text-foreground">
  {!canFull('timetable.manage') ? 'My Schedule' : 'Timetable Management'}
</h1>
{!canFull('timetable.manage') && (
  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
    Personal View
  </Badge>
)}
<p className="text-sm text-muted-foreground">
  {!canFull('timetable.manage')
    ? 'View your teaching schedule and class assignments'
    : 'Manage class schedules and timetables with intelligent conflict detection'}
</p>
{!canFull('timetable.manage') && timetableEntries.length > 0 && (
```

---

## Pattern Summary

### Common Replacement Patterns:

**Pattern 1: Role-based conditional check**
```typescript
// Before
if (profile?.role === 'teacher') { ... }

// After
const { can, canFull } = useFeatureAccess();
if (canFull('relevant.feature')) { ... }
```

**Pattern 2: Role-based ternary for UI text**
```typescript
// Before
{profile?.role === 'teacher' ? 'Teacher Text' : 'Other Text'}

// After
const { canFull } = useFeatureAccess();
{!canFull('timetable.manage') ? 'Teacher Text' : 'Other Text'}
```

**Pattern 3: Admin check (multiple roles)**
```typescript
// Before
const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin';

// After
const { canFull } = useFeatureAccess();
const isAdmin = canFull('relevant.feature');
```

**Pattern 4: Negated role check**
```typescript
// Before
if (profile?.role !== 'super_admin') { return <AccessDenied />; }

// After
const { canFull } = useFeatureAccess();
if (!canFull('feature.needed')) { return <AccessDenied />; }
```

---

## Implementation Notes

1. **Import required**: Add `useFeatureAccess` to imports in each file
2. **Hooks placement**: Call hooks at the top of component functions (after other hooks)
3. **Backward compatibility**: Some components may need `useAuth()` for non-role data (school_id, user_id)
4. **Testing**: Verify each feature is correctly mapped in `access-control.ts` before deployment
5. **RLS Policies**: Backend RLS policies should already enforce these rules, hooks add frontend validation

---

## Batch Implementation Order

1. **Phase 1 (Simplest):** AttendanceManagement, SchoolManagement, SystemSettings
2. **Phase 2 (Medium):** ClassManagement, ClassPerformanceAnalytics, TeacherManagement
3. **Phase 3 (Complex):** SubjectManagement, TimetableManagement
4. **Phase 4 (Verification):** UserManagement and other components

---

## Verification Checklist

- [ ] All `profile?.role ===` checks replaced with `useFeatureAccess()` calls
- [ ] Feature names in `can()` calls match `access-control.ts` matrix
- [ ] Access levels ('full' vs 'read-only') correctly specified
- [ ] Components import `useFeatureAccess` hook
- [ ] No hardcoded role string literals remain
- [ ] Tested with different user roles (super_admin, school_admin, teacher)
- [ ] UI correctly reflects permissions after replacement
- [ ] No console errors or TypeScript errors

