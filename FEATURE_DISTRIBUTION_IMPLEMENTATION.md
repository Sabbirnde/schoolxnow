# Feature Distribution by Stakeholder - Implementation Guide

## Overview

This guide explains how to implement and enforce the feature distribution matrix across the SchoolXNow application. The system uses role-based access control (RBAC) to ensure each user role only has access to the features designated for them.

## Core Components

### 1. Access Control System

**File**: `src/lib/access-control.ts`

Defines the complete feature matrix and provides utilities to check access:

```typescript
import {
  FEATURE_ACCESS_MATRIX,
  hasFeatureAccess,
  getFeatureAccessLevel,
  UserRole,
  AccessLevel
} from '@/lib/access-control';

// Check if user can perform action
hasFeatureAccess('teacher', 'marks.enter', 'full'); // true for teachers

// Get access level
getFeatureAccessLevel('student', 'marks.enter'); // 'none'

// Get all accessible features for a role
getAccessibleFeatures('school_admin'); // Array of features
```

### 2. Feature Access Hooks

**File**: `src/hooks/useFeatureAccess.ts`

Use in React components to check permissions:

```typescript
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

function MyComponent() {
  const { can, canFull, role, is } = useFeatureAccess();

  // Check permission
  if (can('exams.create')) {
    // Show exam creation UI
  }

  // Check full access
  if (canFull('students.delete')) {
    // Show delete button
  }

  // Check role
  if (is('teacher')) {
    // Teacher-specific UI
  }

  // Check multiple roles
  if (is(['super_admin', 'school_admin'])) {
    // Admin-specific UI
  }
}
```

### 3. Component Guards

**File**: `src/components/FeatureGuard.tsx`

Wrapper components for conditional rendering:

```typescript
import {
  FeatureGuard,
  RoleGuard,
  AccessControlButton,
  ConditionalUI
} from '@/components/FeatureGuard';

// Feature-based guard
<FeatureGuard feature="exams.create" requiredLevel="full">
  <ExamCreationForm />
</FeatureGuard>

// Role-based guard
<RoleGuard roles={['super_admin', 'school_admin']}>
  <AdminPanel />
</RoleGuard>

// Conditional UI (shorthand)
<ConditionalUI for="marks.enter" requiredLevel="full">
  <MarkEntryButton />
</ConditionalUI>

// Button with automatic access control
<AccessControlButton
  feature="students.delete"
  requiredLevel="full"
  disabledTooltip="You cannot delete students"
>
  Delete Student
</AccessControlButton>
```

## Feature Distribution Matrix

### Super Admin (🔐)

**Full Access To:**
- User management
- School management
- School admin management
- System settings
- Audit logs
- Analytics (read-only for teachers/students)

**Code Example:**
```typescript
const { can } = useFeatureAccess();

if (can('schools.create', 'full')) {
  // Show school creation UI
}
```

### School Admin (🏫)

**Full Access To:**
- Teacher management (approve, assign classes)
- Student management (create, edit, delete, enroll)
- Class management
- Subject management
- Attendance review & export
- Exam management & marks approval
- Timetable management
- Performance analytics
- Reports & exports

**Code Example:**
```typescript
<FeatureGuard feature="teachers.approve" requiredLevel="full">
  <TeacherApprovalPanel />
</FeatureGuard>
```

### Teachers (👨‍🏫)

**Full Access To:**
- Attendance recording (primary responsibility)
- Marks entry (primary responsibility)
- View own classes & subjects
- Create & manage exams
- Performance analytics by class/subject
- Reports & feedback

**View-Only Access To:**
- Student information
- Timetables
- School calendar

**Code Example:**
```typescript
function AttendanceSheet() {
  return (
    <FeatureGuard feature="attendance.record" requiredLevel="full">
      <AttendanceForm />
    </FeatureGuard>
  );
}
```

### Students (👨‍🎓)

**Full Access To:**
- View own grades & attendance
- View own performance analytics
- View own timetable
- View personal reports

**No Access To:**
- Other students' information
- Grade entry
- Attendance recording
- System administration

**Code Example:**
```typescript
function StudentGrades() {
  return (
    <FeatureGuard feature="marks.view_own" requiredLevel="full">
      <MyGrades />
    </FeatureGuard>
  );
}
```

### Guardians/Parents (👨‍👩‍👧)

**Full Access To:**
- View child's progress & grades
- View child's attendance
- View performance reports
- Export child's data
- Update contact information

**View-Only Access To:**
- Child's timetable
- Subject information

**No Access To:**
- Other children (unless linked to multiple accounts)
- Any administrative functions

**Code Example:**
```typescript
function GuardianDashboard() {
  return (
    <FeatureGuard feature="analytics.view_children" requiredLevel="full">
      <ChildAnalytics />
    </FeatureGuard>
  );
}
```

## Implementation Patterns

### 1. Feature-Gated Component

```typescript
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { DisabledFeatureMessage } from '@/components/FeatureGuard';

function ExamCreationPage() {
  const { can, role } = useFeatureAccess();

  if (!can('exams.create', 'full')) {
    return <DisabledFeatureMessage feature="exams.create" userRole={role} />;
  }

  return <ExamForm />;
}
```

### 2. Dynamic Menu/Navigation

**Used in**: `src/components/AppSidebar.tsx`

```typescript
const menuItemsWithFeatures = [
  {
    title: "Teachers",
    module: "users",
    feature: "teachers.view",
  },
  // ... more items
];

const visibleMenuItems = menuItemsWithFeatures.filter((item) =>
  can(item.feature, "read-only")
);
```

### 3. Action Permission Check

```typescript
function StudentListActions({ student }) {
  const { canFull } = useFeatureAccess();

  return (
    <div>
      {canFull('students.edit') && (
        <Button onClick={() => editStudent(student.id)}>Edit</Button>
      )}

      {canFull('students.delete') && (
        <Button variant="destructive" onClick={() => deleteStudent(student.id)}>
          Delete
        </Button>
      )}
    </div>
  );
}
```

### 4. Protected Route

```typescript
import { ProtectedRoute } from '@/components/FeatureGuard';

<Route
  path="/exams/create"
  element={
    <ProtectedRoute feature="exams.create" requiredLevel="full">
      <ExamCreationPage />
    </ProtectedRoute>
  }
/>
```

## Feature Categories

### User Management
- `users.view` - View users
- `users.create` - Create new users
- `users.edit` - Edit user details
- `users.delete` - Delete users

### Student Management
- `students.view` - View all students
- `students.create` - Add new students
- `students.edit` - Edit student info
- `students.delete` - Remove students
- `students.enroll` - Register in classes
- `students.export` - Export student data

### Teacher Management
- `teachers.view` - View teacher list
- `teachers.create` - Add new teachers
- `teachers.edit` - Edit teacher info
- `teachers.approve` - Approve teacher applications
- `teachers.reject` - Reject applications
- `teachers.assign_classes` - Assign to classes

### Academic Operations
- `attendance.record` - Mark attendance
- `attendance.view` - View attendance records
- `attendance.export` - Export attendance data
- `marks.enter` - Enter exam marks
- `marks.view` - View marks
- `marks.approve` - Approve mark entries
- `exams.create` - Create new exams
- `exams.manage` - Manage exam settings

### Analytics & Reports
- `analytics.view` - View analytics
- `analytics.export` - Export analytics
- `reports.create` - Create custom reports
- `reports.export` - Export reports

### Administration
- `schools.view` - View schools
- `schools.create` - Create schools (super admin only)
- `schools.manage` - Manage school settings
- `system_settings.manage` - System configuration

## Best Practices

### 1. Always Check Permissions

```typescript
// ❌ Bad - Directly using role
if (profile?.role === 'teacher') {
  // Show teacher UI
}

// ✅ Good - Using access control
if (can('marks.enter', 'full')) {
  // Show marks entry UI
}
```

### 2. Use Appropriate Access Level

```typescript
// For viewing data
can('students.view', 'read-only') // or just can('students.view')

// For modifying data
can('students.create', 'full') // Requires 'full' level
```

### 3. Wrap Sensitive Operations

```typescript
// Protect delete operations
function DeleteButton({ id }) {
  const access = useFeatureAccess();

  if (!access.canFull('students.delete')) {
    return null; // Hide button entirely
  }

  return <Button onClick={() => delete(id)}>Delete</Button>;
}
```

### 4. Provide Feedback

```typescript
// Show message when feature is unavailable
<FeatureGuard
  feature="exams.create"
  fallback={<DisabledFeatureMessage feature="exams.create" />}
>
  <ExamForm />
</FeatureGuard>
```

## Testing Access Control

```typescript
import { hasFeatureAccess, getFeatureAccessLevel } from '@/lib/access-control';

describe('Access Control Matrix', () => {
  it('teachers can enter marks', () => {
    expect(hasFeatureAccess('teacher', 'marks.enter', 'full')).toBe(true);
  });

  it('students cannot enter marks', () => {
    expect(hasFeatureAccess('student', 'marks.enter')).toBe(false);
  });

  it('school admins can approve marks', () => {
    expect(getFeatureAccessLevel('school_admin', 'marks.approve')).toBe('full');
  });
});
```

## Troubleshooting

### Feature Not Available

**Problem**: Feature appears unavailable but should be.

**Solution**:
1. Check `FEATURE_ACCESS_MATRIX` in `access-control.ts`
2. Verify feature name matches exactly (case-sensitive)
3. Ensure user role is correct

```typescript
// Debug: Check matrix
console.log(FEATURE_ACCESS_MATRIX['teacher']['marks.enter']); // Should print 'full'
```

### Access Check Always Fails

**Problem**: `can()` always returns false.

**Solution**:
1. Verify `useFeatureAccess()` is called within `AuthProvider`
2. Check `profile?.role` is set correctly
3. Use `role` from hook to debug

```typescript
const { role, can } = useFeatureAccess();
console.log('User role:', role); // Debug role
```

### Menu Item Not Showing

**Problem**: Menu item is missing for user.

**Solution**:
1. Check feature requirement in menu config
2. Verify user has explicit feature access
3. Add feature to matrix if missing

```typescript
const { can } = useFeatureAccess();
console.log('Can view students:', can('students.view')); // Debug visibility
```

## Migration Path

When adding new features:

1. **Add to FEATURE_ACCESS_MATRIX** in `access-control.ts`
2. **Use FeatureGuard** when implementing component
3. **Update menu items** if navigation-related
4. **Test with each role** to verify access levels

Example:

```typescript
// 1. Add to matrix
const FEATURE_ACCESS_MATRIX = {
  teacher: {
    'new_feature.access': 'full',
    // ...
  },
  // ...
};

// 2. Use in component
<FeatureGuard feature="new_feature.access">
  <NewFeature />
</FeatureGuard>

// 3. Test all roles
test('teachers can access new feature', () => {
  expect(can('new_feature.access', 'full')).toBe(true);
});
```

---

**Version**: 1.0
**Last Updated**: 2026-03-23
**Status**: Production Ready ✅
