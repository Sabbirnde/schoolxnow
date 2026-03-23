# RBAC Migration - Implementation Checklist

## Overview
This document provides a structured checklist for migrating hardcoded role checks to the RBAC system using `useFeatureAccess()` hook.

**Status**: Analysis Complete | Ready for Implementation
**Generated**: March 23, 2026
**Total Components**: 9
**Total Role Checks**: 26+

---

## Component Migration Checklist

### ✅ Phase 1: Simple Components (Estimated: 30-45 mins)

- [ ] **AttendanceManagement.tsx** (1 check)
  - [ ] Line 85: `if (profile?.role === 'teacher')` → `attendance.record`
  - [ ] Add import: `import { useFeatureAccess } from '@/hooks/useFeatureAccess';`
  - [ ] Test: Verify teachers see only their classes

- [ ] **SchoolManagement.tsx** (2-3 checks)
  - [ ] Line 65: `if (profile?.role === 'super_admin')` → `schools.view`
  - [ ] Line 63: useEffect conditional
  - [ ] Add import
  - [ ] Test: Verify super_admin can see school management

- [ ] **SystemSettings.tsx** (2-3 checks)
  - [ ] Line 61: `if (profile?.role !== 'super_admin')` → `!canFull('system_settings.manage')`
  - [ ] Update guard page to use feature check
  - [ ] Add import
  - [ ] Test: Verify access denied for non-super_admin users

### ✅ Phase 2: Medium Complexity (Estimated: 45-60 mins)

- [ ] **ClassManagement.tsx** (1-2 checks)
  - [ ] Line 73: `const isAdmin = profile?.role === 'school_admin' || profile?.role === 'super_admin';` → `classes.create`
  - [ ] Add import and hook
  - [ ] Test: Verify admin can see add/edit/delete buttons

- [ ] **ClassPerformanceAnalytics.tsx** (4-5 checks)
  - [ ] Line 75: Teacher class loading → `analytics.by_class`
  - [ ] Line 95: Target class IDs ternary → `classes.my_classes`
  - [ ] Line 99: Another ternary replacement
  - [ ] Line 319: Message display conditional
  - [ ] Add import (may already have useAuth)
  - [ ] Test: Verify teachers see analytics for only their classes

- [ ] **TeacherManagement.tsx** (1-2 checks)
  - [ ] Line 111: School admin filter → `teachers.view`
  - [ ] Add import
  - [ ] Test: Verify school admins see only their school's teachers

### ✅ Phase 3: Complex Components (Estimated: 90-120 mins)

- [ ] **SubjectManagement.tsx** (10-11 checks) ⚠️ Most Complex
  - [ ] Lines 94, 106, 117: useEffect conditionals → `subjects.create` / `subjects.view`
  - [ ] Line 190: Teacher subject loading → `subjects.assign`
  - [ ] Line 337: Button disabled state
  - [ ] Line 340: Button visibility
  - [ ] Lines 349, 358: Header text conditionals → `subjects.assign`
  - [ ] Lines 450, 454, 467: Message display conditionals
  - [ ] Add import and hook (add to existing hooks)
  - [ ] Careful testing with all user roles
  - [ ] Verify role-based UI changes work correctly

- [ ] **TimetableManagement.tsx** (6 checks)
  - [ ] Line 94: Teacher schedule query filter
  - [ ] Line 114: Another stage of filtering
  - [ ] Line 587: Header text ternary → `timetable.manage`
  - [ ] Line 589: Badge visibility
  - [ ] Line 596-602: Description and stats visibility
  - [ ] Add import (may already have useAuth)
  - [ ] Test thoroughly: Teachers should see only their schedule, admins see full view

---

## Pre-Implementation Checklist

- [ ] Review `src/lib/access-control.ts` to confirm all feature names
- [ ] Review `src/hooks/useFeatureAccess.ts` to understand hook API
- [ ] All developers are familiar with feature matrix
- [ ] Database RLS policies are already in place (they should be)
- [ ] Create a feature branch: `feature/rbac-migration`

---

## Per-Component Implementation Steps

### For Each Component:

1. **Import the hook**
   ```typescript
   import { useFeatureAccess } from '@/hooks/useFeatureAccess';
   ```

2. **Add hook call in component**
   ```typescript
   const { can, canFull, is } = useFeatureAccess();
   ```

3. **Replace each role check**
   - Find: `profile?.role === 'roleX'`
   - Identify mapped feature from HARDCODED_ROLE_CHECKS_MAPPING.md
   - Replace with `can()` or `canFull()` call

4. **Test the component**
   - Test with super_admin role
   - Test with school_admin role
   - Test with teacher role
   - Verify UI elements show/hide correctly
   - No console errors

5. **Commit with message**
   ```
   Migrate [Component] from hardcoded roles to RBAC

   - Replaced X role checks with useFeatureAccess()
   - Features: feature.name, feature.name2
   - Tested with: super_admin, school_admin, teacher
   ```

---

## Testing Strategy

### Test Cases for Each Component

**Scenario 1: Super Admin Access**
- [ ] Can view all features
- [ ] Can perform all actions (create, edit, delete)
- [ ] Can select schools when required

**Scenario 2: School Admin Access**
- [ ] Can view school-scoped data
- [ ] Cannot access super_admin-only features
- [ ] Can manage teachers and subjects in their school
- [ ] Cannot see other school's data

**Scenario 3: Teacher Access**
- [ ] Can view only their assigned classes
- [ ] Can record attendance for their classes
- [ ] Can enter marks for their classes
- [ ] Cannot create/edit/delete base entities
- [ ] Cannot access admin interfaces

**Scenario 4: Multiple Roles** (if applicable)
- [ ] User with multiple roles sees appropriate features
- [ ] UI reflects highest permission level

---

## Common Issues & Solutions

### Issue: Feature not in access-control.ts
**Solution**: Check the feature name spelling. If truly missing, add to FEATURE_ACCESS_MATRIX

### Issue: Hook returns wrong permission
**Solution**: Verify the feature name maps to correct access level. Check RBAC matrix.

### Issue: UI still shows restricted content after replacement
**Solution**: 
- Verify the component is actually using the new hook call
- Check useAuth() profile is properly loaded
- Inspect browser console for errors
- Verify RLS policies on backend

### Issue: Can't import useFeatureAccess
**Solution**: Verify file exists at `src/hooks/useFeatureAccess.ts`. Check import path.

---

## Code Quality Checklist

For each replacement, verify:
- [ ] No hardcoded role strings remain in component
- [ ] Import statements are present
- [ ] Hook is called at top-level of component
- [ ] Feature name matches access-control.ts
- [ ] Access level ('full' vs 'read-only') is correct
- [ ] Ternary operators or conditionals are properly updated
- [ ] No TypeScript errors
- [ ] Component still passes visual inspection

---

## Rollback Plan

If issues arise after migration:

1. **Issue in single component**: Revert only that component file
2. **Issues in multiple components**: Revert entire feature branch
3. **Production issue**: Use git revert for specific commits

Command:
```bash
git revert <commit-hash> --no-edit
```

---

## Migration Log

### Day 1: [DATE]
- [ ] Completed Phase 1 components
- [ ] Issues: [list any]
- [ ] Commits: [list hashes]

### Day 2: [DATE]
- [ ] Completed Phase 2 components
- [ ] Issues: [list any]
- [ ] Commits: [list hashes]

### Day 3: [DATE]
- [ ] Completed Phase 3 components
- [ ] Final testing
- [ ] Issues: [list any]
- [ ] Commits: [list hashes]

### Final: [DATE]
- [ ] All components migrated
- [ ] All tests passing
- [ ] No console errors
- [ ] Code review completed
- [ ] Ready for merge to main

---

## Resources

1. **Access Control Configuration**: `src/lib/access-control.ts`
2. **Hook Documentation**: `src/hooks/useFeatureAccess.ts`
3. **Feature Matrix Guide**: FEATURE_DISTRIBUTION_IMPLEMENTATION.md
4. **Complete Mapping**: HARDCODED_ROLE_CHECKS_MAPPING.md (detailed)
5. **Quick Reference**: HARDCODED_ROLE_CHECKS_MAPPING.csv

---

## Sign-Off

- [ ] Migration initiated by: _________________ Date: _______
- [ ] Phase 1 completed by: _________________ Date: _______
- [ ] Phase 2 completed by: _________________ Date: _______
- [ ] Phase 3 completed by: _________________ Date: _______
- [ ] Code review approved: _________________ Date: _______
- [ ] Merged to main: _________________ Date: _______

