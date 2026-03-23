# E2E Testing Execution Guide

**Status**: ✅ Ready to Execute  
**Date**: March 23, 2026  
**Scope**: RBAC system across 5 user roles  

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Verify Dev Server Running
```bash
# In terminal, from project root
npm run dev
# Should see: ✓ vite has transformed 200+ modules
```

### Step 2: Open Application
- **URL**: http://localhost:5173
- **Clear browser cache**: Ctrl+Shift+Delete (DevTools → Application → Clear All)

### Step 3: Open Browser DevTools
- Press `F12` or `Ctrl+Shift+I`
- Go to **Console** tab

### Step 4: Run Quick Validation
```javascript
// Copy-paste in console:
window.rbacDebug.testAll()
```

Expected output shows test results for all 5 roles. If you see "All tests passed", you're ready! ✅

---

## 📋 Testing Phases

### Phase 1: Automated Browser Testing (30 minutes)

Execute these commands in browser console (F12 → Console):

#### 1.1 Test All Roles
```javascript
window.rbacDebug.testAll()
```
✅ This runs all 5 role test cases at once

#### 1.2 Test Individual Roles
```javascript
window.rbacDebug.testRole('super_admin')
window.rbacDebug.testRole('school_admin')
window.rbacDebug.testRole('teacher')
window.rbacDebug.testRole('student')
window.rbacDebug.testRole('guardian')
```

#### 1.3 Generate Feature Summary
```javascript
window.rbacDebug.getFeatureSummary()
```

#### 1.4 Export Test Report
```javascript
const report = window.rbacDebug.exportReport()
console.log(JSON.stringify(report, null, 2))
// Copy-paste output to file: test-report.json
```

**Expected**: All tests PASS ✅

---

### Phase 2: Manual Route Testing (30 minutes)

Test each protected route with different roles:

#### 2.1 Test /teacher-portal Route
```
❌ Log in as School Admin
   → Navigate to: http://localhost:5173/teacher-portal
   → EXPECT: Redirect to /dashboard
   ✓ Verify: URL changes to /dashboard
   ✓ Verify: No error in console

✅ Log in as Teacher
   → Navigate to: http://localhost:5173/teacher-portal
   → EXPECT: Portal loads successfully
   ✓ Verify: Portal page displays
   ✓ Verify: Can see teacher-specific content
```

#### 2.2 Test /system-admin-access Route
```
❌ Log in as School Admin
   → Navigate to: http://localhost:5173/system-admin-access
   → EXPECT: Redirect to /dashboard
   ✓ Verify: URL changes to /dashboard

❌ Log in as Teacher
   → Navigate to: http://localhost:5173/system-admin-access
   → EXPECT: Redirect to /dashboard
   ✓ Verify: URL changes to /dashboard

✅ Log in as Super Admin
   → Navigate to: http://localhost:5173/system-admin-access
   → EXPECT: Admin page loads
   ✓ Verify: Admin interface displays correctly
```

#### 2.3 Test /dashboard Route (All Roles)
```
✅ Log in as each role
   → Navigate to: http://localhost:5173/dashboard
   → EXPECT: Dashboard loads for each role
   ✓ Verify: Role-specific dashboard displays
   ✓ Verify: User name and role shown correctly
```

**Expected**: All authorized routes load, unauthorized redirects succeed ✅

---

### Phase 3: Manual Module Testing (1 hour 20 minutes)

Test module access for each role by clicking sidebar items:

#### 3.1 Super Admin Module Access
```
Log in as: super_admin@test.edu

❌ NOT Accessible:
   - Students (read-only only)
   - Reports (read-only only)

✅ Fully Accessible:
   - ☑ Schools
   - ☑ Users (School Admins)
   - ☑ Settings (System)
   - ☑ Dashboard (Audit logs)

Test Each:
  1. Click menu item
  2. EXPECT: Module loads
  3. Verify no error in console
  4. Verify content displays
  5. Check: Can interact with features
```

#### 3.2 School Admin Module Access
```
Log in as: schooladmin@test.edu

✅ Fully Accessible:
  - ☑ Students (CRUD)
  - ☑ Classes
  - ☑ Subjects
  - ☑ Attendance
  - ☑ Exams
  - ☑ Timetable
  - ☑ Teachers
  - ☑ Reports
  - ☑ Dashboard

❌ NOT Accessible (Try clicking):
  - Schools (should show error)
  - System Settings (should show error)

Test Each Module:
  1. Click in sidebar
  2. EXPECT: Module loads
  3. Verify features are editable (not read-only)
```

#### 3.3 Teacher Module Access
```
Log in as: teacher@test.edu

✅ Fully Accessible:
  - ☑ My Subjects
  - ☑ My Classes
  - ☑ Attendance (Record)
  - ☑ Exam Marks (Enter)
  - ☑ Timetable (My Schedule)

✅ Read-Only Access:
  - ☑ Students (view my class students)
  - ☑ Exams (view only)

❌ NOT Accessible:
  - Schools
  - Users (Teachers)
  - System Settings
  - Class Assignment

Test Each Module:
  1. Click in sidebar
  2. For fully accessible: EXPECT editable
  3. For read-only: EXPECT view-only (no edit buttons)
  4. For not accessible: EXPECT error page
```

#### 3.4 Student Module Access
```
Log in as: student@test.edu

✅ Accessible Modules (View-Only):
  - ☑ My Marks (read-only)
  - ☑ My Attendance (read-only)
  - ☑ My Timetable (read-only)

❌ NOT Accessible:
  - Any management module
  - Teacher tools
  - Admin features

Test Each:
  1. Click items in sidebar
  2. EXPECT: View-only data
  3. EXPECT: No edit/delete buttons
  4. EXPECT: No access to management modules
```

#### 3.5 Guardian Module Access
```
Log in as: guardian@test.edu

✅ Accessible Modules (Child's Data):
  - ☑ Child Marks (read-only)
  - ☑ Child Attendance (read-only)
  - ☑ Child Reports (read-only)

❌ NOT Accessible:
  - All management modules
  - Any teacher features
  - Other children's data

Test Each:
  1. Can view child data only
  2. EXPECT: View-only access
  3. EXPECT: Child selector if multiple children
  4. EXPECT: No edit capability
```

**Expected**: Correct module access per role ✅

---

### Phase 4: Security & Error Handling (20 minutes)

#### 4.1 Unauthorized Access Attempts
```
Test 1: Try accessing feature via console
  Log in as: teacher@test.edu
  Open console (F12)
  
  // Try to check super_admin feature
  window.rbacDebug.testRole('super_admin')
  
  EXPECT: Report shows "❌ Denied" for teacher
  VERIFY: Teacher cannot access super_admin features

Test 2: Try accessing restricted module
  Log in as: student@test.edu
  Click on "Users" (Teachers) in sidebar
  
  EXPECT: Access denied screen shown
  EXPECT: "Back to Dashboard" button visible
  VERIFY: Can return to dashboard safely

Test 3: Try changing activeModule via browser
  Log in as: student@test.edu
  Open console
  
  // Try to force module access
  window.location.hash = '#?module=users'
  
  EXPECT: Dashboard re-renders with access check
  EXPECT: Error shown if unauthorized
```

#### 4.2 Permission Boundary Testing
```
Test 1: Full vs Read-Only Access
  Log in as: teacher@test.edu
  
  Attendance Module (Full Access):
    - EXPECT: Can see "Record Attendance" button
    - EXPECT: Can enter new attendance
    - EXPECT: Can edit existing records
  
  Exams Module (Read-Only Access):
    - EXPECT: Can see exam details
    - EXPECT: NO "Create Exam" button
    - EXPECT: NO edit/delete buttons

Test 2: Cross-Role Permission Check
  Compare permissions:
  - Super Admin: Can do everything
  - School Admin: Can manage school only
  - Teacher: Can manage own classes only
  - Student: View own data only
```

**Expected**: All security boundaries enforced ✅

---

### Phase 5: Navigation & Menu Filtering (15 minutes)

#### 5.1 Menu Item Visibility
```
Super Admin:
  EXPECT: See school-level menu items
  EXPECT: See (or not) student management

School Admin:
  EXPECT: See student, class, teacher items
  EXPECT: NOT see system settings
  EXPECT: See analytics/reports

Teacher:
  EXPECT: See only personal tools
  EXPECT: NOT see user management
  EXPECT: See My Classes, My Subjects

Student:
  EXPECT: See only own data
  EXPECT: Very limited menu

Guardian:
  EXPECT: See only child data
  EXPECTED: No management options
```

#### 5.2 Menu Responsiveness
```
Test 1: Switch between roles
  1. Log in as teacher
  2. Verify menu reflects teacher access
  3. Log out
  4. Log in as admin
  5. EXPECT: Menu updates for admin
  6. Verify different items shown

Test 2: Module switching
  1. Log in as school admin
  2. Click "Students" → Loads
  3. Click "Teachers" → Loads
  4. Click "Attendance" → Loads
  5. EXPECT: All menus smoothly switch
```

**Expected**: Menu correctly filtered by role ✅

---

## 📊 Test Results Checklist

### Automated Tests (Console)
```
☑ window.rbacDebug.testAll() - PASSED
☑ window.rbacDebug.testRole('super_admin') - PASSED
☑ window.rbacDebug.testRole('school_admin') - PASSED
☑ window.rbacDebug.testRole('teacher') - PASSED
☑ window.rbacDebug.testRole('student') - PASSED
☑ window.rbacDebug.testRole('guardian') - PASSED
```

### Route Protection
```
☑ /teacher-portal protected (teachers only)
☑ /system-admin-access protected (super_admin only)
☑ /dashboard accessible to all authenticated users
☑ Unauthorized redirects to /dashboard work
```

### Module Access
```
☑ Super Admin: 5/5 modules accessible
☑ School Admin: 11/11 modules accessible
☑ Teacher: 8/8 modules accessible
☑ Student: 3-5/5 modules accessible
☑ Guardian: 2-4/5 modules accessible
```

### Security
```
☑ No unauthorized role elevation possible
☑ Access denied screens show correctly
☑ No errors in browser console
☑ Features protected appropriately
☑ Read-only enforcement works
```

### Navigation
```
☑ Menu items hidden for unauthorized roles
☑ Menu updates when switching roles
☑ All visible menu items are accessible
☑ Module switching works smoothly
```

---

## 🐛 Issue Reporting

If you find an issue during testing:

```
TEMPLATE:
─────────────────────────────────────
Issue: [Title]
Severity: [Critical/High/Medium/Low]
Steps to Reproduce:
  1. [Action 1]
  2. [Action 2]
  3. [Action 3]

Expected Result:
  [What should happen]

Actual Result:
  [What actually happened]

Browser Console:
  [Any errors shown]

Role Tested:
  [super_admin/school_admin/teacher/student/guardian]

URL:
  [Page being tested]

Browser/OS:
  [Chrome/Firefox] on [Windows/Mac/Linux]
─────────────────────────────────────
```

---

## ✅ Sign-Off Checklist

Before marking testing complete, verify:

```
RBAC System - E2E Testing Sign-Off
=====================================

Date: _________________
Tester: _________________
Hours Spent: _________________

Automated Tests:
  ☑ All 5 role tests pass
  ☑ No console errors
  ☑ Feature matrix verified

Route Protection:
  ☑ /teacher-portal working
  ☑ /system-admin-access working
  ☑ Redirects functioning

Module Testing:
  ☑ Super Admin modules (5/5)
  ☑ School Admin modules (11/11)
  ☑ Teacher modules (8/8)
  ☑ Student modules (3-5/5)
  ☑ Guardian modules (2-4/5)

Security:
  ☑ No permission escalation possible
  ☑ Access denial working
  ☑ Read-only enforced
  ☑ No unauthorized data access

Navigation:
  ☑ Menu filtering working
  ☑ Module switching smooth
  ☑ Role transitions clean

Issues Found: _____
Critical Issues: _____
Blockers: None / [List]

OVERALL RESULT:
☑ PASS - Ready for deployment
☐ PASS WITH MINOR ISSUES - Document and proceed
☐ FAIL - Issues require fixing

Sign-off: ___________________
Date: ___________________
```

---

## 📈 Success Criteria

✅ **Testing is SUCCESSFUL when:**

1. All automated tests pass (window.rbacDebug.testAll())
2. All 5 roles have correct access to their resources
3. Unauthorized access attempts are properly denied
4. All routes protect correctly
5. All 24 modules enforce access control
6. Menu items hide/show based on role
7. No JavaScript errors in console
8. No permission escalation possible
9. Error messages are clear
10. All core features work as expected

---

## 🔧 Troubleshooting

### Issue: `window.rbacDebug is undefined`
**Solution**: 
- Make sure dev server is running
- Check that import.meta.env.DEV is true
- Refresh page and check console

### Issue: Tests fail for a role
**Solution**:
- Check if test account has correct role in Supabase
- Verify access-control.ts has features for that role
- Run single test: `window.rbacDebug.testRole('role_name')`

### Issue: Route redirects incorrectly
**Solution**:
- Verify ProtectedRoute props are correct in App.tsx
- Check roles array matches user profile.role
- Clear browser cache and try again

### Issue: Module won't load
**Solution**:
- Check module is in MODULE_REGISTRY
- Verify role has feature access for module
- Check browser console for errors
- Try logging out and back in

---

## 📚 Reference Documents

- [E2E_TESTING_PLAN.md](E2E_TESTING_PLAN.md) - Complete detailed test scenarios
- [E2E_TESTING_CHECKLIST.md](E2E_TESTING_CHECKLIST.md) - Printable checklist
- [CONSOLE_TESTING_REFERENCE.md](CONSOLE_TESTING_REFERENCE.md) - Copy-paste commands
- [RBAC_QUICK_REFERENCE.md](RBAC_QUICK_REFERENCE.md) - Developer reference
- [ACCESS_CONTROL.md](src/lib/access-control.ts) - Feature matrix

---

## ⏱️ Estimated Timeline

- **Phase 1 (Automated)**: 30 min
- **Phase 2 (Routes)**: 30 min
- **Phase 3 (Modules)**: 1 hour 20 min
- **Phase 4 (Security)**: 20 min
- **Phase 5 (Navigation)**: 15 min
- **Analysis & Reporting**: 15 min

**Total**: 3.5 - 4 hours for complete testing

---

## 🎯 Next Steps After Testing

1. ✅ Complete all test phases above
2. ✅ Fill out sign-off checklist
3. ✅ Document any issues found
4. ✅ Fix critical issues if found
5. ✅ Retest if issues were fixed
6. ✅ Mark as READY FOR DEPLOYMENT

---

**Ready to test?** Start with Phase 1 - open your browser console and run:
```javascript
window.rbacDebug.testAll()
```

Good luck! 🚀
