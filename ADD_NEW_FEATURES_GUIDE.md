# How to Add New Features to RBAC System

This guide explains how to add a new feature to SchoolXNow with proper role-based access control.

## 5-Step Process

### Step 1: Add Feature to Access Control Matrix

**File**: `src/lib/access-control.ts`

Edit the `FEATURE_ACCESS_MATRIX` and add your feature for each role:

```typescript
export const FEATURE_ACCESS_MATRIX: Record<UserRole, Record<string, AccessLevel>> = {
  super_admin: {
    // ... existing features ...
    'reports.schedule': 'full',      // ← New feature
  },
  school_admin: {
    // ... existing features ...
    'reports.schedule': 'full',      // Admins can schedule reports
  },
  teacher: {
    // ... existing features ...
    'reports.schedule': 'read-only', // Teachers see scheduled reports, can't create new
  },
  student: {
    // ... existing features ...
    'reports.schedule': 'none',      // Students can't schedule reports
  },
  guardian: {
    // ... existing features ...
    'reports.schedule': 'none',      // Guardians can't schedule reports
  },
};
```

**Feature Naming Convention**:
- `{category}.{action}` (e.g., `reports.schedule`)
- `{category}.view`, `{category}.create`, `{category}.edit`, `{category}.delete`
- `{category}.{action}_{target}` (e.g., `marks.view_own`, `students.view_children`)

**Access Levels**:
- `'full'` - Can create, read, update, delete
- `'read-only'` - Can only view
- `'none'` - No access

### Step 2: Create the Feature Component/Page

Example: Creating a Report Scheduling feature

```typescript
// src/components/ReportScheduler.tsx
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { FeatureGuard, DisabledFeatureMessage } from '@/components/FeatureGuard';
import { useToast } from '@/hooks/use-toast';

export function ReportScheduler() {
  const { can, role } = useFeatureAccess();
  const { toast } = useToast();

  // Feature not available for this role
  if (!can('reports.schedule')) {
    return <DisabledFeatureMessage feature="reports.schedule" userRole={role} />;
  }

  // Only admins can actually create
  const canCreate = can('reports.schedule', 'full');

  return (
    <div>
      {canCreate ? (
        <ScheduleReportForm onSave={handleSave} />
      ) : (
        <ViewScheduledReports />
      )}
    </div>
  );
}

function ScheduleReportForm({ onSave }) {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSave();
    }}>
      {/* Form fields */}
    </form>
  );
}

function ViewScheduledReports() {
  return <div>Scheduled reports read-only view</div>;
}
```

### Step 3: Guard Component with FeatureGuard

Wrap the component in access control:

```typescript
// src/pages/ReportsPage.tsx
import { FeatureGuard, RoleGuard } from '@/components/FeatureGuard';
import { ReportScheduler } from '@/components/ReportScheduler';

export function ReportsPage() {
  return (
    <FeatureGuard
      feature="reports.schedule"
      fallback={<NoFeatureAccess />}
    >
      <ReportScheduler />
    </FeatureGuard>
  );
}
```

### Step 4: Add to Navigation (if needed)

**File**: `src/components/AppSidebar.tsx`

The sidebar automatically filters menu items based on feature access. If you added a new section:

```typescript
const menuItemsWithFeatures = [
  // ... existing items ...
  {
    title: "Report Scheduler",
    module: "report-scheduler",
    feature: "reports.schedule",  // ← Sidebar will show this only if user has access
  },
];
```

The menu item will automatically show/hide based on user role.

### Step 5: Test with All Roles

**Option A: Browser Console (Development)**

```javascript
// Open browser console (F12)
window.rbacDebug.testRole('teacher');   // Test teacher access
window.rbacDebug.testRole('student');   // Test student access
window.rbacDebug.exportReport();        // Export test report
```

**Option B: Automated Testing**

```typescript
// src/lib/__tests__/rbac.test.ts
import { hasFeatureAccess } from '@/lib/access-control';

describe('Report Scheduler Feature', () => {
  it('admins can schedule reports', () => {
    expect(hasFeatureAccess('school_admin', 'reports.schedule', 'full')).toBe(true);
  });

  it('teachers can only view scheduled reports', () => {
    expect(hasFeatureAccess('teacher', 'reports.schedule', 'full')).toBe(false);
    expect(hasFeatureAccess('teacher', 'reports.schedule', 'read-only')).toBe(true);
  });

  it('students cannot access report scheduler', () => {
    expect(hasFeatureAccess('student', 'reports.schedule')).toBe(false);
  });
});
```

**Option C: Manual Testing**

1. Log in as Super Admin → Verify feature works
2. Log in as School Admin → Verify feature works
3. Log in as Teacher → Verify limited access
4. Log in as Student → Verify no access
5. Log in as Guardian → Verify no access

## Complete Example: Adding "Student Progress Export"

### Step 1: Add to Matrix

```typescript
export const FEATURE_ACCESS_MATRIX = {
  super_admin: {
    'exports.student_progress': 'full',
  },
  school_admin: {
    'exports.student_progress': 'full',
  },
  teacher: {
    'exports.student_progress': 'full',  // Teachers export their students
  },
  student: {
    'exports.student_progress': 'none',
  },
  guardian: {
    'exports.student_progress': 'full',  // Gets own child's data
  },
};
```

### Step 2: Create Component

```typescript
// src/components/StudentProgressExport.tsx
export function StudentProgressExport({ studentId }) {
  const { canFull } = useFeatureAccess();

  return (
    <FeatureGuard feature="exports.student_progress" requiredLevel="full">
      <Button onClick={() => exportProgress(studentId)}>
        Export Progress
      </Button>
    </FeatureGuard>
  );
}

async function exportProgress(studentId: string) {
  const data = await fetchStudentProgress(studentId);
  downloadCSV(data, `student-${studentId}-progress.csv`);
}
```

### Step 3: Use in Component

```typescript
// Anywhere in the app
<StudentProgressExport studentId={student.id} />

// Will automatically:
// ✅ Show for admins and teachers
// ✅ Show for guardians (their own children)
// ❌ Hide for students
```

## Common Patterns

### Pattern 1: Full CRUD Operations

```typescript
export const FEATURE_ACCESS_MATRIX = {
  school_admin: {
    'subjects.view': 'read-only',
    'subjects.create': 'full',
    'subjects.edit': 'full',
    'subjects.delete': 'full',
  },
};

// In component:
const { can } = useFeatureAccess();

if (can('subjects.create', 'full')) <CreateButton />
if (can('subjects.edit', 'full')) <EditButton />
if (can('subjects.delete', 'full')) <DeleteButton />
if (can('subjects.view')) <ViewDetails />
```

### Pattern 2: Progressive Disclosure

```typescript
export const FEATURE_ACCESS_MATRIX = {
  teacher: {
    'students.view': 'full',
    'students.view_detailed': 'read-only',
    'students.edit': 'none',
  },
};

// In component:
<Card>
  <StudentBasicInfo />
  
  <ConditionalUI for="students.view_detailed">
    <StudentDetailedInfo />
  </ConditionalUI>
  
  <AccessControlButton feature="students.edit">
    Edit Student
  </AccessControlButton>
</Card>
```

### Pattern 3: Role-Specific Features

```typescript
export const FEATURE_ACCESS_MATRIX = {
  teacher: {
    'quick_attendance.access': 'full',
  },
  school_admin: {
    'quick_attendance.access': 'read-only',
  },
  student: {
    'quick_attendance.access': 'none',
  },
};

// In component:
<FeatureGuard feature="quick_attendance.access">
  <QuickAttendanceSheet />
</FeatureGuard>
```

## Troubleshooting

### Q: Feature shows for wrong role
**A**: Check `FEATURE_ACCESS_MATRIX` has correct role assignments

### Q: Menu item doesn't appear
**A**: Verify feature name in `menuItemsWithFeatures` matches exactly

### Q: Access control not working
**A**: Ensure component is wrapped with `<FeatureGuard>` or uses `useFeatureAccess()`

### Q: Tests fail for new feature
**A**: Add feature to `defaultTestCases` in `rbac-testing.ts`

## API Reference

### Adding Feature Checks

```typescript
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

const { 
  can,              // can('feature.name', 'read-only')
  canFull,          // canFull('feature.name')
  level,            // level('feature.name') → 'full' | 'read-only' | 'none'
  role,             // Current user role
  is,               // is('teacher') or is(['teacher', 'admin'])
} = useFeatureAccess();
```

### Feature Guard Components

```typescript
// Gate entire component
<FeatureGuard feature="feature.name" fallback={<Disabled />}>
  <Component />
</FeatureGuard>

// Conditional rendering
<ConditionalUI for="feature.name">
  <Show />
  <elseShow><Disabled /></elseShow>
</ConditionalUI>

// Gate buttons
<AccessControlButton feature="feature.name" requiredLevel="full">
  Action Button
</AccessControlButton>

// Container with conditional styling
<AccessControlItem feature="feature.name">
  <Content />
</AccessControlItem>
```

## Verification Checklist

When adding a new feature, verify:

- [ ] Feature added to `FEATURE_ACCESS_MATRIX` for all 5 roles
- [ ] Feature name follows convention: `category.action`
- [ ] Component wrapped with `<FeatureGuard>` or uses `useFeatureAccess()`
- [ ] Navigation menu item has correct feature reference (if applicable)
- [ ] Tested with all applicable user roles
- [ ] Test case added to `defaultTestCases` in `rbac-testing.ts`
- [ ] Feature documented in this guide
- [ ] Error messages use `DisabledFeatureMessage` component

---

**Version**: 1.0
**Last Updated**: 2026-03-23
**Status**: Production Ready ✅
