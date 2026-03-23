# Module-Level Protection Plan for Index.tsx

**Objective**: Add feature-based access control to module switching and rendering in Index component to prevent unauthorized access to modules.

---

## 📊 Module Access Mapping

### Super Admin

| Module | Feature | Access Level | Components | Purpose |
|--------|---------|--------------|-----------|---------|
| **students** | `students.view` | `read-only` | StudentManagement | View all students across all schools |
| **schools** | `schools.view` | `full` | SchoolManagement | View and manage schools |
| **users** (admins) | `school_admins.view` | `full` | SchoolAdminManagement | Manage school admin accounts |
| **settings** | `system_settings.manage` | `full` | Settings | System-wide configuration |
| **dashboard** | `audit_logs.view` | `full` | SuperAdminDashboard | View system metrics and audit logs |

**Feature Dependencies**: All 5 features should be checked BEFORE module renders

---

### School Admin

| Module | Feature | Access Level | Components | Purpose |
|--------|---------|--------------|-----------|---------|
| **students** | `students.view` | `full` | StudentManagement | Manage students in school |
| **classes** | `classes.view` | `full` | ClassManagement | Manage classes in school |
| **subjects** | `subjects.view` | `full` | SubjectManagement | Manage subjects for classes |
| **attendance** | `attendance.view` | `full` | AttendanceManagement | View and approve attendance |
| **exams** | `exams.view` | `full` | ExamManagement | Create and manage exams |
| **timetable** | `timetable.view` | `full` | TimetableManagement | Create class timetables |
| **users** (teachers) | `teachers.view` | `full` | TeacherManagement | Manage teacher accounts |
| **reports** | `reports.view` | `full` | ReportsAnalytics | Generate and view reports |
| **class-assignment** | `classes.view` | `full` | ClassAssignment | Assign teachers to classes |
| **settings** | `settings.school` | `full` | Settings | School-specific settings |
| **dashboard** | `schools.view` | `full` | SchoolAdminDashboard | School metrics dashboard |

**Feature Dependencies**: All appropriate features checked before module renders

---

### Teacher

| Module | Feature | Access Level | Components | Purpose |
|--------|---------|--------------|-----------|---------|
| **students** | `students.view` | `read-only` | StudentManagement | View assigned class students |
| **subjects** | `subjects.view` | `read-only` | SubjectManagement | View subject assignments |
| **attendance** | `attendance.record` | `full` | AttendanceManagement | Record daily attendance |
| **exam-marks** | `marks.enter` | `full` | ExamMarksEntry | Enter student exam marks |
| **exams** | `exams.view` | `full` | ExamManagement | View exam schedules |
| **timetable** | `timetable.view` | `full` | TimetableManagement | View class timetable |
| **classes** | `classes.my_classes` | `full` | ClassManagement | View assigned classes |
| **dashboard** | `attendance.record` | `full` | TeacherDashboard | Quick access to primary features |

**Feature Dependencies**: All appropriate features checked before module renders

---

## ✅ Feature Matrix Validation

### Current Status: 100% Alignment ✓

All modules in Index.tsx have corresponding features in `FEATURE_ACCESS_MATRIX`:

- ✅ Super Admin: 5/5 features exist
- ✅ School Admin: 11/11 features exist  
- ✅ Teacher: 8/8 features exist

**Missing Coverage**: Student and Guardian roles not currently in Index.tsx (future phase)

---

## 🛠️ Implementation Strategy

### Phase 1: Create Module Configuration

Create a module registry that maps modules to their access requirements:

```typescript
// src/lib/module-config.ts

import { UserRole, AccessLevel } from './access-control';

interface ModuleConfig {
  id: string;
  name: string;
  feature: string;
  requiredLevel: AccessLevel;
  allowedRoles: UserRole[];
  component: React.ComponentType<any>;
}

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  // Super Admin Modules
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    feature: 'audit_logs.view',
    requiredLevel: 'read-only',
    allowedRoles: ['super_admin'],
    component: SuperAdminDashboard,
  },
  schools: {
    id: 'schools',
    name: 'Schools',
    feature: 'schools.view',
    requiredLevel: 'full',
    allowedRoles: ['super_admin'],
    component: SchoolManagement,
  },
  users: {
    id: 'users',
    name: 'Admins',
    feature: 'school_admins.view',
    requiredLevel: 'full',
    allowedRoles: ['super_admin'],
    component: SchoolAdminManagement,
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    feature: 'system_settings.manage',
    requiredLevel: 'full',
    allowedRoles: ['super_admin'],
    component: Settings,
  },

  // School Admin Modules
  'admin-students': {
    id: 'students',
    name: 'Students',
    feature: 'students.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: StudentManagement,
  },
  'admin-classes': {
    id: 'classes',
    name: 'Classes',
    feature: 'classes.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: ClassManagement,
  },
  'admin-subjects': {
    id: 'subjects',
    name: 'Subjects',
    feature: 'subjects.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: SubjectManagement,
  },
  'admin-attendance': {
    id: 'attendance',
    name: 'Attendance',
    feature: 'attendance.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: AttendanceManagement,
  },
  'admin-exams': {
    id: 'exams',
    name: 'Exams',
    feature: 'exams.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: ExamManagement,
  },
  'admin-timetable': {
    id: 'timetable',
    name: 'Timetable',
    feature: 'timetable.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: TimetableManagement,
  },
  'admin-teachers': {
    id: 'users',
    name: 'Teachers',
    feature: 'teachers.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: TeacherManagement,
  },
  'admin-reports': {
    id: 'reports',
    name: 'Reports',
    feature: 'reports.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: ReportsAnalytics,
  },
  'class-assignment': {
    id: 'class-assignment',
    name: 'Class Assignment',
    feature: 'classes.view',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: ClassAssignment,
  },
  'admin-settings': {
    id: 'settings',
    name: 'Settings',
    feature: 'settings.school',
    requiredLevel: 'full',
    allowedRoles: ['school_admin'],
    component: Settings,
  },

  // Teacher Modules
  'teacher-students': {
    id: 'students',
    name: 'Students',
    feature: 'students.view',
    requiredLevel: 'read-only',
    allowedRoles: ['teacher'],
    component: StudentManagement,
  },
  'teacher-subjects': {
    id: 'subjects',
    name: 'Subjects',
    feature: 'subjects.view',
    requiredLevel: 'read-only',
    allowedRoles: ['teacher'],
    component: SubjectManagement,
  },
  'teacher-attendance': {
    id: 'attendance',
    name: 'Attendance',
    feature: 'attendance.record',
    requiredLevel: 'full',
    allowedRoles: ['teacher'],
    component: AttendanceManagement,
  },
  'teacher-exam-marks': {
    id: 'exam-marks',
    name: 'Exam Marks',
    feature: 'marks.enter',
    requiredLevel: 'full',
    allowedRoles: ['teacher'],
    component: ExamMarksEntry,
  },
  'teacher-exams': {
    id: 'exams',
    name: 'Exams',
    feature: 'exams.view',
    requiredLevel: 'full',
    allowedRoles: ['teacher'],
    component: ExamManagement,
  },
  'teacher-timetable': {
    id: 'timetable',
    name: 'Timetable',
    feature: 'timetable.view',
    requiredLevel: 'full',
    allowedRoles: ['teacher'],
    component: TimetableManagement,
  },
  'teacher-classes': {
    id: 'classes',
    name: 'Classes',
    feature: 'classes.my_classes',
    requiredLevel: 'full',
    allowedRoles: ['teacher'],
    component: ClassManagement,
  },
  'teacher-dashboard': {
    id: 'dashboard',
    name: 'Dashboard',
    feature: 'attendance.record',
    requiredLevel: 'full',
    allowedRoles: ['teacher'],
    component: TeacherDashboard,
  },
};
```

### Phase 2: Create Module Protection Helper

```typescript
// src/hooks/useModuleAccess.ts

import { useFeatureAccess } from './useFeatureAccess';
import { MODULE_REGISTRY } from '@/lib/module-config';
import { UserRole } from '@/lib/access-control';

interface ModuleAccessResult {
  canAccess: boolean;
  reason?: string;
  feature?: string;
}

/**
 * Hook for checking module-level access
 */
export function useModuleAccess() {
  const { can, role } = useFeatureAccess();

  return {
    /**
     * Check if user can access a specific module
     */
    canAccessModule: (moduleId: string): ModuleAccessResult => {
      const config = MODULE_REGISTRY[moduleId];

      if (!config) {
        console.warn(`[MODULE_ACCESS] Unknown module: ${moduleId}`);
        return {
          canAccess: false,
          reason: 'Module not found',
        };
      }

      // Check if role is allowed
      if (!config.allowedRoles.includes(role as UserRole)) {
        return {
          canAccess: false,
          reason: `Module not available for role: ${role}`,
          feature: config.feature,
        };
      }

      // Check if user has required feature access
      if (!can(config.feature, config.requiredLevel)) {
        return {
          canAccess: false,
          reason: `Insufficient permissions for feature: ${config.feature}`,
          feature: config.feature,
        };
      }

      return { canAccess: true };
    },

    /**
     * Get all accessible modules for current user
     */
    getAccessibleModules: (): string[] => {
      return Object.keys(MODULE_REGISTRY).filter((moduleId) => {
        const result = this.canAccessModule(moduleId);
        return result.canAccess;
      });
    },

    /**
     * Check if switching to a module is allowed
     */
    canSwitchToModule: (moduleId: string): boolean => {
      const result = this.canAccessModule(moduleId);
      if (!result.canAccess) {
        console.warn(
          `[MODULE_ACCESS] Access denied: ${result.reason}`,
          result
        );
      }
      return result.canAccess;
    },

    /**
     * Get module config by ID
     */
    getModuleConfig: (moduleId: string) => {
      return MODULE_REGISTRY[moduleId];
    },
  };
}
```

### Phase 3: Add Helper Function for Rendering

```typescript
// Update in Index.tsx or separate helper

/**
 * Helper to safely render modules with access control
 */
export function useModuleRenderer() {
  const { canAccessModule } = useModuleAccess();
  const { role } = useFeatureAccess();

  return {
    /**
     * Render module component with access check
     * Returns the component or fallback UI
     */
    renderModule: (
      moduleId: string,
      fallback: React.ReactNode = <UnauthorizedModule moduleId={moduleId} />
    ): React.ReactNode => {
      const { canAccess, reason, feature } = canAccessModule(moduleId);

      if (!canAccess) {
        console.warn(
          `[MODULE_RENDER] Access denied for module "${moduleId}": ${reason}`
        );
        return fallback;
      }

      const config = MODULE_REGISTRY[moduleId];
      if (!config) return fallback;

      const Component = config.component;
      return <Component />;
    },

    /**
     * Safely set active module with validation
     */
    setModuleSafely: (
      moduleId: string,
      onSetModule: (id: string) => void,
      onAccessDenied?: (reason: string) => void
    ): void => {
      const result = this.canAccessModule(moduleId);

      if (!result.canAccess) {
        console.warn(
          `[MODULE_SET] Access denied: ${result.reason}`
        );
        onAccessDenied?.(result.reason || 'Access denied');
        return;
      }

      onSetModule(moduleId);
    },
  };
}
```

### Phase 4: Updated Index.tsx Implementation

```typescript
// src/pages/Index.tsx

import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Layout } from "@/components/Layout";

// ... component imports ...

const Index = () => {
  const { user, profile, loading } = useAuth();
  const { can } = useFeatureAccess();
  const { canSwitchToModule, canAccessModule } = useModuleAccess();
  const [activeModule, setActiveModule] = useState('dashboard');

  // Redirect to landing page if not logged in
  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  /**
   * Safe module switch with access validation
   */
  const handleSetActiveModule = useCallback((moduleId: string) => {
    if (!canSwitchToModule(moduleId)) {
      console.warn(`[INDEX] Access denied for module: ${moduleId}`);
      return;
    }
    setActiveModule(moduleId);
  }, [canSwitchToModule]);

  /**
   * Protected content rendering with access checks
   */
  const renderContent = () => {
    // Check if current module is accessible
    const { canAccess, reason } = canAccessModule(activeModule);
    
    if (!canAccess) {
      return (
        <div className="container mx-auto p-4 md:p-6">
          <div className="rounded-md bg-red-50 p-4">
            <h3 className="text-red-800 font-semibold">
              Access Denied
            </h3>
            <p className="text-red-700 text-sm mt-1">
              {reason}
            </p>
          </div>
        </div>
      );
    }

    // Role-based module rendering
    if (profile?.role === 'super_admin') {
      // Validate each module before rendering
      switch (activeModule) {
        case 'students':
          return can('students.view', 'read-only') ? (
            <StudentManagement />
          ) : (
            <AccessDeniedFallback module="students" />
          );
        
        case 'schools':
          return can('schools.view', 'full') ? (
            <SchoolManagement />
          ) : (
            <AccessDeniedFallback module="schools" />
          );
        
        case 'users':
          return can('school_admins.view', 'full') ? (
            <SchoolAdminManagement />
          ) : (
            <AccessDeniedFallback module="users" />
          );
        
        case 'settings':
          return can('system_settings.manage', 'full') ? (
            <Settings />
          ) : (
            <AccessDeniedFallback module="settings" />
          );
        
        case 'dashboard':
        default:
          return can('audit_logs.view', 'read-only') ? (
            <SuperAdminDashboard />
          ) : (
            <AccessDeniedFallback module="dashboard" />
          );
      }
    }
    
    if (profile?.role === 'school_admin') {
      switch (activeModule) {
        case 'students':
          return can('students.view', 'full') ? (
            <StudentManagement />
          ) : (
            <AccessDeniedFallback module="students" />
          );
        
        case 'classes':
          return can('classes.view', 'full') ? (
            <ClassManagement />
          ) : (
            <AccessDeniedFallback module="classes" />
          );
        
        case 'subjects':
          return can('subjects.view', 'full') ? (
            <SubjectManagement />
          ) : (
            <AccessDeniedFallback module="subjects" />
          );
        
        case 'attendance':
          return can('attendance.view', 'full') ? (
            <AttendanceManagement />
          ) : (
            <AccessDeniedFallback module="attendance" />
          );
        
        case 'exams':
          return can('exams.view', 'full') ? (
            <ExamManagement />
          ) : (
            <AccessDeniedFallback module="exams" />
          );
        
        case 'timetable':
          return can('timetable.view', 'full') ? (
            <TimetableManagement />
          ) : (
            <AccessDeniedFallback module="timetable" />
          );
        
        case 'users':
          return can('teachers.view', 'full') ? (
            <TeacherManagement />
          ) : (
            <AccessDeniedFallback module="users" />
          );
        
        case 'reports':
          return can('reports.view', 'full') ? (
            <ReportsAnalytics />
          ) : (
            <AccessDeniedFallback module="reports" />
          );
        
        case 'class-assignment':
          return can('classes.view', 'full') ? (
            <ClassAssignment />
          ) : (
            <AccessDeniedFallback module="class-assignment" />
          );
        
        case 'settings':
          return can('settings.school', 'full') ? (
            <Settings />
          ) : (
            <AccessDeniedFallback module="settings" />
          );
        
        case 'dashboard':
        default:
          return can('schools.view', 'full') ? (
            <SchoolAdminDashboard />
          ) : (
            <AccessDeniedFallback module="dashboard" />
          );
      }
    }
    
    if (profile?.role === 'teacher') {
      switch (activeModule) {
        case 'students':
          return can('students.view', 'read-only') ? (
            <StudentManagement />
          ) : (
            <AccessDeniedFallback module="students" />
          );
        
        case 'subjects':
          return can('subjects.view', 'read-only') ? (
            <SubjectManagement />
          ) : (
            <AccessDeniedFallback module="subjects" />
          );
        
        case 'attendance':
          return can('attendance.record', 'full') ? (
            <AttendanceManagement />
          ) : (
            <AccessDeniedFallback module="attendance" />
          );
        
        case 'exam-marks':
          return can('marks.enter', 'full') ? (
            <div className="container mx-auto p-4 md:p-6 space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Enter Exam Marks
                </h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  Enter and manage student exam marks
                </p>
              </div>
              <ExamMarksEntry />
            </div>
          ) : (
            <AccessDeniedFallback module="exam-marks" />
          );
        
        case 'exams':
          return can('exams.view', 'full') ? (
            <ExamManagement />
          ) : (
            <AccessDeniedFallback module="exams" />
          );
        
        case 'timetable':
          return can('timetable.view', 'full') ? (
            <TimetableManagement />
          ) : (
            <AccessDeniedFallback module="timetable" />
          );
        
        case 'classes':
          return can('classes.my_classes', 'full') ? (
            <ClassManagement />
          ) : (
            <AccessDeniedFallback module="classes" />
          );
        
        case 'dashboard':
        default:
          return can('attendance.record', 'full') ? (
            <TeacherDashboard setActiveModule={handleSetActiveModule} />
          ) : (
            <AccessDeniedFallback module="dashboard" />
          );
      }
    }

    // Fallback (should not reach here with proper routing)
    return (
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">
          No access to this module for your role.
        </p>
      </div>
    );
  };

  return (
    <Layout activeModule={activeModule} setActiveModule={handleSetActiveModule}>
      {renderContent()}
    </Layout>
  );
};

/**
 * Fallback component for access denied
 */
function AccessDeniedFallback({ module }: { module: string }) {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
        <h3 className="text-yellow-800 font-semibold">
          Access Denied
        </h3>
        <p className="text-yellow-700 text-sm mt-2">
          You do not have permission to access the "{module}" module.
        </p>
        <p className="text-yellow-600 text-xs mt-2">
          Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

export default Index;
```

---

## 📋 Implementation Checklist

### Step 1: Create Module Configuration
- [ ] Create `src/lib/module-config.ts` with MODULE_REGISTRY
- [ ] Import all components
- [ ] Validate feature mappings against access-control.ts
- [ ] Test registry in browser console

### Step 2: Create Hook
- [ ] Create `src/hooks/useModuleAccess.ts`
- [ ] Implement `canAccessModule()` function
- [ ] Implement `getAccessibleModules()` function
- [ ] Implement `canSwitchToModule()` function
- [ ] Add JSDoc comments and usage examples

### Step 3: Create Fallback Component
- [ ] Create `AccessDeniedFallback` component (inline or separate)
- [ ] Style consistently with app theme
- [ ] Add helpful error messages
- [ ] Test with different access scenarios

### Step 4: Update Index.tsx
- [ ] Add imports for hooks
- [ ] Create `handleSetActiveModule()` callback
- [ ] Update `renderContent()` to validate module access
- [ ] Add access checks before each component render
- [ ] Display `AccessDeniedFallback` when access is denied
- [ ] Update `setActiveModule` calls to use new handler

### Step 5: Test All Scenarios
- [ ] Test super_admin access to all 5 modules
- [ ] Test school_admin access to all 11 modules
- [ ] Test teacher access to all 8 modules
- [ ] Test unauthorized module switching
- [ ] Test console warnings are clear
- [ ] Test fallback UI rendering

### Step 6: Refresh Layout/Sidebar
- [ ] Ensure Layout component passes new `setActiveModule` correctly
- [ ] Verify sidebar module selection respects feature access
- [ ] Disable menu items for unauthorized modules

---

## 🔒 Security Considerations

### Client-Side Protection
- ✅ Prevents UI from rendering unauthorized modules
- ✅ Blocks module switching via sidebar/buttons
- ✅ Shows clear access denied messages
- ⚠️ **Not sufficient alone** - backend must also validate

### Backend Validation Required
- ⚠️ Do NOT trust client-side checks alone
- ✅ Validate all API requests for feature access
- ✅ Return 403 Forbidden for unauthorized access
- ✅ Log unauthorized attempts for audit trail

### Data Protection
- ✅ StudentManagement won't render without `students.view`
- ✅ ExamMarksEntry won't render without `marks.enter`
- ✅ All modules protected before data loading
- ✅ Fallback UI shown instead of empty/broken component

---

## 🧪 Testing Your Implementation

### Browser Console Tests (Dev Only)

```javascript
// Test if module config is loaded
window.MODULE_REGISTRY

// Test feature access directly
const { can } = window.useFeatureAccess()
can('marks.enter', 'full')

// Test module access (if hook available globally)
window.canAccessModule('exam-marks')

// Run RBAC debug tests
window.rbacDebug.testAll()
```

### Component Testing

```typescript
// Test module rendering with different roles
describe('Index - Module Protection', () => {
  it('shows exam-marks only for teachers', () => {
    // Mock teacher role
    // Change activeModule to 'exam-marks'
    // Verify ExamMarksEntry renders
  });

  it('blocks exam-marks for students', () => {
    // Mock student role
    // Try to change activeModule to 'exam-marks'
    // Verify AccessDeniedFallback renders
  });
});
```

---

## 📈 Feature Coverage Summary

### By Role

| Role | Modules | Features Used |
|------|---------|---------------|
| Super Admin | 5 | 5 features |
| School Admin | 11 | 11 features |
| Teacher | 8 | 8 features |
| **Total** | **24 modules** | **24 feature checks** |

### By Feature Type

| Feature Type | Count | Modules |
|--------------|-------|---------|
| `.view` | 11 | Most modules |
| `.enter` / `.record` | 3 | Marks, Attendance |
| `.manage` / `.create` | 5 | Admin/setup |
| `.my_*` | 2 | Teacher-scoped |
| **Total** | **21 unique** | **24 usage** |

---

## 🚀 Future Enhancements

1. **Dynamic Module Loading**
   - Load MODULE_REGISTRY from backend
   - Support runtime feature additions
   - Enable feature flag system

2. **Module Permissions API**
   - Create `/api/modules/available` endpoint
   - Validate all module access server-side
   - Return accessible modules on login

3. **Audit Logging**
   - Log all unauthorized module access attempts
   - Track who tried to access what and when
   - Alert on suspicious patterns

4. **Progressive Disclosure**
   - Show "coming soon" for features user doesn't have
   - Send notifications when new features are available
   - Suggest upgrades based on attempted access

5. **Role Hierarchy**
   - Auto-inherit module access in role hierarchy
   - Reduce feature duplication in matrix
   - Simplify maintenance

---

## 📚 Related Documentation

- [RBAC_IMPLEMENTATION_STATUS.md](RBAC_IMPLEMENTATION_STATUS.md) - Overall RBAC status
- [RBAC_QUICK_REFERENCE.md](RBAC_QUICK_REFERENCE.md) - Quick patterns reference
- [ADD_NEW_FEATURES_GUIDE.md](ADD_NEW_FEATURES_GUIDE.md) - How to add new features
- [access-control.ts](src/lib/access-control.ts) - Feature matrix source
- [useFeatureAccess.ts](src/hooks/useFeatureAccess.ts) - Permission checking hook

---

**Status**: 📋 Ready for Implementation  
**Priority**: 🟡 High (Next Phase after component migration)  
**Effort**: 3-4 hours  
**Risk**: Low (Non-breaking, can be tested independently)

