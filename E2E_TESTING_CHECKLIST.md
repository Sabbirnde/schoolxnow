# RBAC E2E Testing - Quick Execution Checklist

**Testing Session**: _____________  
**Date**: _____________  
**Tester**: _____________  
**Environment**: [ ] Dev | [ ] Staging | [ ] Prod  

---

## Pre-Test Setup Checklist

### 1. Environment Preparation
- [ ] Node.js 18+ installed
- [ ] Dev server running (`npm run dev`)
- [ ] Supabase project accessible
- [ ] Browser DevTools ready (F12)
- [ ] All 5 test accounts created and available
- [ ] Network connection stable
- [ ] No VPN/Firewall restrictions

### 2. Test Accounts Verified
- [ ] superadmin@test.edu - Super Admin role
- [ ] schooladmin@test.edu - School Admin role
- [ ] teacher@test.edu - Teacher role
- [ ] student@test.edu - Student role
- [ ] guardian@test.edu - Guardian role
- [ ] All passwords working correctly

### 3. Test Data Available
- [ ] Schools created in Supabase
- [ ] Classes created for school
- [ ] Students enrolled in classes
- [ ] Teachers assigned to classes
- [ ] Exams created
- [ ] Attendance records exist
- [ ] Marks entered for students

---

## TC-SA-001: Super Admin Full Access ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Route Tests
- [ ] Can access `/system-admin-access` ✅
- [ ] Can access `/dashboard` ✅
- [ ] Cannot access `/teacher-portal` (redirected) ✅

### Sidebar Verification
- [ ] Dashboard visible ✅
- [ ] Schools visible ✅
- [ ] School Admins visible ✅
- [ ] Settings visible ✅
- [ ] Teachers menu hidden ✅
- [ ] Attendance menu hidden ✅

### Feature Tests
- [ ] Can create schools ✅
- [ ] Can edit schools ✅
- [ ] Can delete schools ✅
- [ ] Can create school admins ✅
- [ ] Can view audit logs ✅
- [ ] Cannot enter marks ✅
- [ ] Cannot record attendance ✅

### Console Tests
```javascript
// Expected all true
hasFeatureAccess('super_admin', 'schools.create', 'full') // ✅ true
hasFeatureAccess('super_admin', 'audit_logs.view') // ✅ true
hasFeatureAccess('super_admin', 'marks.enter') // ✅ false
```

- [ ] Console tests passed ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-002: School Admin Access ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Route Tests
- [ ] Cannot access `/system-admin-access` (redirected) ✅
- [ ] Can access `/dashboard` ✅
- [ ] Cannot access `/teacher-portal` (redirected) ✅

### Sidebar Verification (11 modules expected)
- [ ] Dashboard ✅
- [ ] Students ✅
- [ ] Classes ✅
- [ ] Subjects ✅
- [ ] Attendance ✅
- [ ] Exams ✅
- [ ] Timetable ✅
- [ ] Teachers ✅
- [ ] Reports ✅
- [ ] Class Assignment ✅
- [ ] Settings ✅
- [ ] Schools hidden ✅
- [ ] Audit Logs hidden ✅

### Teacher Management Tests
- [ ] Can create teacher ✅
- [ ] Can edit teacher ✅
- [ ] Can delete teacher ✅
- [ ] Can approve/reject teacher ✅

### Student Management Tests
- [ ] Can create student ✅
- [ ] Can edit student ✅
- [ ] Can delete student ✅
- [ ] Can enroll student ✅

### Attendance Tests
- [ ] Can view all attendance ✅
- [ ] Can approve attendance ✅
- [ ] Cannot record attendance ✅

### Marks Tests
- [ ] Can approve marks ✅
- [ ] Can view all marks ✅
- [ ] Cannot enter marks ✅

### Console Tests
```javascript
hasFeatureAccess('school_admin', 'teachers.create', 'full') // ✅ true
hasFeatureAccess('school_admin', 'marks.approve') // ✅ true
hasFeatureAccess('school_admin', 'schools.create') // ✅ false
hasFeatureAccess('school_admin', 'marks.enter') // ✅ false
```

- [ ] Console tests passed ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-003: Teacher Access ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Route Tests
- [ ] Can access `/teacher-portal` ✅
- [ ] Can access `/dashboard` ✅
- [ ] Cannot access `/system-admin-access` (redirected) ✅

### Sidebar Verification (8 modules expected)
- [ ] Dashboard ✅
- [ ] Students (read-only) ✅
- [ ] Classes ✅
- [ ] Subjects (read-only) ✅
- [ ] Attendance ✅
- [ ] Enter Exam Marks ✅
- [ ] Exams ✅
- [ ] Timetable (read-only) ✅
- [ ] Schools hidden ✅
- [ ] Teacher Management hidden ✅

### Attendance Tests
- [ ] Can record attendance ✅
- [ ] Can view attendance ✅
- [ ] Can export attendance ✅
- [ ] Cannot approve attendance ✅

### Marks Entry Tests
- [ ] Can access "Enter Exam Marks" ✅
- [ ] Can enter marks ✅
- [ ] Can bulk import marks ✅
- [ ] Cannot approve marks ✅
- [ ] Cannot delete marks ✅

### Student View Tests (Read-Only)
- [ ] Can view student list ✅
- [ ] Can view student details ✅
- [ ] Cannot create student ✅
- [ ] Cannot edit student ✅

### Console Tests
```javascript
hasFeatureAccess('teacher', 'attendance.record', 'full') // ✅ true
hasFeatureAccess('teacher', 'marks.enter', 'full') // ✅ true
hasFeatureAccess('teacher', 'marks.approve') // ✅ false
hasFeatureAccess('teacher', 'students.create') // ✅ false
```

- [ ] Console tests passed ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-004: Student Access ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Dashboard Tests
- [ ] Student dashboard loads ✅
- [ ] Shows only student's data ✅

### Marks Access
- [ ] Can view own marks ✅
- [ ] Can view marks by subject ✅
- [ ] Cannot see other students' marks ✅

### Attendance Access
- [ ] Can view own attendance ✅
- [ ] Can see attendance percentage ✅
- [ ] Cannot see other students' attendance ✅

### Timetable Access
- [ ] Can view own class timetable ✅
- [ ] Cannot see other classes' timetables ✅

### Classes Access
- [ ] Can view own class ✅
- [ ] Cannot edit class information ✅

### Profile Settings
- [ ] Can edit profile ✅
- [ ] Can change password ✅
- [ ] Cannot edit role ✅

### Restrictive Features (Should be hidden)
- [ ] Teachers menu hidden ✅
- [ ] Students management hidden ✅
- [ ] System settings hidden ✅

### Route Access
- [ ] Cannot access `/teacher-portal` (redirected) ✅
- [ ] Cannot access `/system-admin-access` (redirected) ✅

### Console Tests
```javascript
hasFeatureAccess('student', 'marks.view_own') // ✅ true
hasFeatureAccess('student', 'attendance.view_own') // ✅ true
hasFeatureAccess('student', 'marks.enter') // ✅ false
hasFeatureAccess('student', 'students.create') // ✅ false
```

- [ ] Console tests passed ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-005: Guardian Access ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Dashboard Tests
- [ ] Guardian dashboard loads ✅
- [ ] Shows child information ✅
- [ ] Can select child (if multiple) ✅

### Child Marks Access
- [ ] Can view child's marks ✅
- [ ] Can view performance trends ✅
- [ ] Cannot see other children's marks ✅

### Child Attendance Access
- [ ] Can view child's attendance ✅
- [ ] Can see attendance percentage ✅
- [ ] Cannot record attendance ✅

### Child Timetable Access
- [ ] Can view child's timetable ✅

### Progress Reports
- [ ] Can download child's progress report ✅
- [ ] Can view performance analytics ✅

### Profile Settings
- [ ] Can edit own profile ✅
- [ ] Can update contact info ✅
- [ ] Cannot edit child's profile ✅

### Restrictive Features (Should be hidden)
- [ ] Teachers menu hidden ✅
- [ ] Students management hidden ✅
- [ ] Attendance recording hidden ✅

### Route Access
- [ ] Cannot access `/teacher-portal` (redirected) ✅
- [ ] Cannot access `/system-admin-access` (redirected) ✅

### Console Tests
```javascript
hasFeatureAccess('guardian', 'students.view_children') // ✅ true
hasFeatureAccess('guardian', 'marks.view_children') // ✅ true
hasFeatureAccess('guardian', 'marks.enter') // ✅ false
hasFeatureAccess('guardian', 'attendance.record') // ✅ false
```

- [ ] Console tests passed ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-006: Unauthorized Access Attempts ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Student Bypassing Teacher Features
- [ ] Student cannot access `/teacher-portal` ✅
- [ ] Student cannot access "Enter Marks" module ✅
- [ ] Student cannot record attendance ✅

### Student Bypassing Admin Features
- [ ] Student cannot access `/system-admin-access` ✅
- [ ] Student cannot see Schools menu ✅
- [ ] Student cannot see Teacher menu ✅

### Teacher Bypassing Super Admin Features
- [ ] Teacher cannot access `/system-admin-access` ✅
- [ ] Teacher cannot see Schools menu ✅
- [ ] Teacher cannot see Audit Logs ✅

### Teacher Bypassing School Admin Features
- [ ] Teacher cannot see Teacher Management ✅
- [ ] Teacher cannot approve marks ✅
- [ ] Teacher cannot manage classes ✅

### Guardian Bypassing Teacher Features
- [ ] Guardian cannot access `/teacher-portal` ✅
- [ ] Guardian cannot record attendance ✅

### Console Access Denial
- [ ] All denied features return false in console ✅

### Error UI Display
- [ ] AccessDeniedFallback shown when appropriate ✅
- [ ] Clear error message displayed ✅
- [ ] "Back to Dashboard" button works ✅

### Console Errors
- [ ] No JavaScript errors on access denial ✅
- [ ] Appropriate warnings logged ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-007: Permission Boundaries ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### School Admin - Full vs Read-Only
- [ ] Students: Full access (create/edit/delete) ✅
- [ ] Classes: Full access ✅
- [ ] Attendance: Approve only (no record) ✅
- [ ] Marks: Approve only (no entry) ✅
- [ ] Schools: No access at all ✅

### Teacher - Write-Specific Access
- [ ] Attendance: Record only (no approve) ✅
- [ ] Marks: Entry only (no approve) ✅
- [ ] Students: Read-only ✅
- [ ] Classes: View own only ✅

### Console Level Tests
```javascript
// School Admin
hasFeatureAccess('school_admin', 'students.create', 'full') // ✅ true
hasFeatureAccess('school_admin', 'marks.enter', 'full') // ✅ false
hasFeatureAccess('school_admin', 'marks.approve') // ✅ true

// Teacher
hasFeatureAccess('teacher', 'marks.enter', 'full') // ✅ true
hasFeatureAccess('teacher', 'marks.approve') // ✅ false
hasFeatureAccess('teacher', 'attendance.record', 'full') // ✅ true
```

- [ ] All console tests passed ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-008: Role Switching & Sessions ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Login as Super Admin
- [ ] Logged in successfully ✅
- [ ] Super admin modules visible ✅

### Switch to School Admin
- [ ] Logout successful ✅
- [ ] Login as school admin successful ✅
- [ ] Modules changed to school admin set ✅
- [ ] Super admin modules no longer visible ✅

### Switch to Teacher
- [ ] Logout successful ✅
- [ ] Login as teacher successful ✅
- [ ] Modules changed to teacher set ✅
- [ ] School admin modules no longer visible ✅

### Session Persistence
- [ ] Refresh page while logged in ✅
- [ ] Still logged in with same role ✅
- [ ] Permissions unchanged after refresh ✅

### Multiple Tab Tests
- [ ] Open new tab, login as different role ✅
- [ ] First tab unaffected ✅
- [ ] Each tab maintains own session ✅

### Console Feature Verification
```javascript
// Feature access changes based on current logged-in role
// After switching role, these should change:
hasFeatureAccess(currentRole, 'schools.create')
hasFeatureAccess(currentRole, 'marks.enter')
```

- [ ] Console verified role switching ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-009: Navigation Filtering ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Super Admin Sidebar
- [ ] 4+ admin modules visible ✅
- [ ] No teacher modules visible ✅
- [ ] No student modules visible ✅
- [ ] All visible items clickable ✅

### School Admin Sidebar
- [ ] 11 modules visible ✅
- [ ] Different from super admin ✅
- [ ] Schools hidden ✅
- [ ] Teacher modules partially visible ✅
- [ ] All visible items clickable ✅

### Teacher Sidebar
- [ ] 8 modules visible ✅
- [ ] Different from school admin ✅
- [ ] Admin modules hidden ✅
- [ ] "Enter Exam Marks" visible ✅
- [ ] All visible items clickable ✅

### Student Sidebar
- [ ] 4 modules visible ✅
- [ ] Management modules hidden ✅
- [ ] All visible items clickable ✅

### Guardian Sidebar
- [ ] 2-3 modules visible ✅
- [ ] Teacher/Admin modules hidden ✅
- [ ] All visible items clickable ✅

### Navigation Testing
- [ ] Click each menu item, no errors ✅
- [ ] Correct module loads for each item ✅
- [ ] Console shows no errors ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## TC-SA-010: Error Handling & Access Denial ✅

**Pass/Fail**: ☐ PASS | ☐ FAIL  
**Duration**: _____ minutes  
**Tester Initials**: _____

### Fallback UI Display
- [ ] AccessDeniedFallback shows on denial ✅
- [ ] Error message clear and helpful ✅
- [ ] Module name shown in error ✅
- [ ] "Back to Dashboard" button visible ✅

### Back to Dashboard Function
- [ ] Click "Back to Dashboard" works ✅
- [ ] Dashboard loads without errors ✅
- [ ] Fallback removed from view ✅

### Console Warning Logs
- [ ] Module access denial logged ✅
- [ ] Warning format clear and useful ✅
- [ ] No JavaScript errors ✅

### Unauthorized Route Access
- [ ] Accessing `/teacher-portal` as student redirects ✅
- [ ] Redirected smoothly without error page ✅
- [ ] Dashboard loads normally ✅

### No Security Info Disclosure
- [ ] Errors don't reveal system architecture ✅
- [ ] Errors don't show database structure ✅
- [ ] Errors don't expose other users' data ✅
- [ ] Errors don't show sensitive file paths ✅

### Graceful Degradation
- [ ] UI elements gracefully hide ✅
- [ ] No broken UI visible ✅
- [ ] Remaining features work normally ✅

### Issues Found
```
_________________________________________________________________

_________________________________________________________________
```

---

## Automated Console Test Results

### Run Quick Console Test
```javascript
// Copy-paste this entire block into browser console:

console.log('🚀 RBAC Quick Test');
console.log('1. Super Admin schools.create:', hasFeatureAccess('super_admin', 'schools.create'));
console.log('2. School Admin marks.enter:', hasFeatureAccess('school_admin', 'marks.enter'));
console.log('3. Teacher marks.enter:', hasFeatureAccess('teacher', 'marks.enter'));
console.log('4. Student marks.enter:', hasFeatureAccess('student', 'marks.enter'));
console.log('5. Guardian marks.enter:', hasFeatureAccess('guardian', 'marks.enter'));
```

**Results**: ✅ PASS | ☐ FAIL

```
Output:
_________________________________________________________________

_________________________________________________________________
```

### Test Summary Results

- [ ] generateAccessSummary() returns valid data ✅
- [ ] runAllTests() shows passing tests ✅
- [ ] exportTestReport() generates valid JSON ✅
- [ ] logTestResults() displays formatted output ✅
- [ ] verifyFeatureConfiguration() works correctly ✅

---

## Final Summary

### Test Execution Scorecard

| Test Case | Status | Duration | Notes |
|-----------|--------|----------|-------|
| TC-SA-001 | ☐ PASS | ____ min | |
| TC-SA-002 | ☐ PASS | ____ min | |
| TC-SA-003 | ☐ PASS | ____ min | |
| TC-SA-004 | ☐ PASS | ____ min | |
| TC-SA-005 | ☐ PASS | ____ min | |
| TC-SA-006 | ☐ PASS | ____ min | |
| TC-SA-007 | ☐ PASS | ____ min | |
| TC-SA-008 | ☐ PASS | ____ min | |
| TC-SA-009 | ☐ PASS | ____ min | |
| TC-SA-010 | ☐ PASS | ____ min | |

**Total Tests Passed**: _____ / 10  
**Total Tests Failed**: _____ / 10  
**Success Rate**: _____%

---

## Critical Issues Found

```
1. ____________________________________________________________________

2. ____________________________________________________________________

3. ____________________________________________________________________
```

## Non-Critical Issues Found

```
1. ____________________________________________________________________

2. ____________________________________________________________________
```

---

## Tester Certification

By signing below, I certify that I have completed all test scenarios above according to the documented test plan and that the results documented here are accurate to the best of my knowledge.

**Tester Name**: ________________________  
**Tester Signature**: ________________________  
**Date**: ________________________  

**QA Lead Review**: ________________________  
**Approval Status**: ☐ APPROVED | ☐ APPROVED WITH NOTES | ☐ REJECTED

**Approval Notes**:
```
_____________________________________________________________________

_____________________________________________________________________
```

---

## Next Steps

- [ ] All critical issues resolved
- [ ] All non-critical issues logged for future sprints
- [ ] Documentation updated if changes made
- [ ] Ready for production deployment
- [ ] Schedule post-deployment verification
- [ ] Plan regression testing for future releases

---

**Document Version**: 1.0  
**Last Updated**: March 23, 2026  
**For Latest Updates**: See E2E_TESTING_PLAN.md  

