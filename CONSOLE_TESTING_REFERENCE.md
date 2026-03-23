# Browser Console Testing Reference

Quick copy-paste commands for RBAC testing in browser DevTools Console (F12)

---

## Quick Commands

### ⚡ One-Line Tests

```javascript
// Current user info
console.log({role: profile?.role, id: profile?.id, school: profile?.school_id})

// Test if current user can access feature
can('marks.enter')                                  // boolean
can('marks.enter', 'full')                          // boolean
can('marks.enter', 'read-only')                     // boolean

// Get feature access level
getFeatureAccessLevel(profile?.role, 'students.view')   // 'full' | 'read-only' | 'none'

// Get all features accessible by role
getAccessibleFeatures(profile?.role)                // array of features

// Test module access
canAccessModule('students')                         // { canAccess: boolean, reason: string }

// Run all automated tests
runAllTests()                                       // { passed, failed, results }

// Get access summary
generateAccessSummary()                             // { super_admin: {...}, school_admin: {...} }

// Export detailed report
exportTestReport()                                  // JSON object
```

---

## Feature Access Testing

### Test Single Feature (Current User)

```javascript
// Test if can access feature
can('students.view')                    // Can I view students?
can('students.create')                  // Can I create students?
can('marks.enter')                      // Can I enter marks?
can('attendance.record')                // Can I record attendance?
can('schools.create')                   // Can I create schools?

// Results: true (yes) or false (no)
```

### Test Feature for Specific Role

```javascript
// Test super_admin
hasFeatureAccess('super_admin', 'schools.create')       // true
hasFeatureAccess('super_admin', 'marks.enter')          // false

// Test school_admin
hasFeatureAccess('school_admin', 'teachers.create')     // true
hasFeatureAccess('school_admin', 'schools.create')      // false

// Test teacher
hasFeatureAccess('teacher', 'attendance.record', 'full')  // true
hasFeatureAccess('teacher', 'marks.approve')            // false

// Test student
hasFeatureAccess('student', 'marks.view_own')           // true
hasFeatureAccess('student', 'marks.enter')              // false

// Test guardian
hasFeatureAccess('guardian', 'students.view_children')  // true
hasFeatureAccess('guardian', 'marks.enter')             // false
```

### Check Access Level

```javascript
// Get the access level for a feature (returns: 'full', 'read-only', or 'none')
getFeatureAccessLevel('super_admin', 'schools.view')        // Returns: 'full'
getFeatureAccessLevel('school_admin', 'schools.view')       // Returns: 'read-only'
getFeatureAccessLevel('teacher', 'schools.view')            // Returns: 'none'
getFeatureAccessLevel('student', 'marks.view_own')          // Returns: 'full'
```

---

## Module Access Testing

### Check Module Accessibility

```javascript
// Check if current user can access module
canAccessModule('students')      // { canAccess: true, reason: "", feature: "students.view", ... }
canAccessModule('schools')       // { canAccess: false, reason: "not available for students", ... }
canAccessModule('exam-marks')   // { canAccess: true|false, ... }
canAccessModule('attendance')   // { canAccess: true|false, ... }

// For each role
const modules = ['students', 'teachers', 'schools', 'marks', 'attendance'];
modules.forEach(m => {
  const result = canAccessModule(m);
  console.log(`${m}: ${result.canAccess ? '✅' : '❌'}`);
});
```

### Get Modules for Current Role

```javascript
// Get all accessible modules for current role
const visibleModules = getModulesByRole?.(profile?.role);
console.log(`${profile?.role} has ${visibleModules.length} modules`);
visibleModules.forEach(m => console.log(`  - ${m.title}`));
```

---

## Comprehensive Test Suites

### Scenario 1: Test All 5 Roles

```javascript
// Test each role's feature access
const roles = ['super_admin', 'school_admin', 'teacher', 'student', 'guardian'];

roles.forEach(role => {
  console.group(`\n🔍 Testing ${role}:`);
  
  const tests = [
    { feature: 'schools.create', expected: role === 'super_admin' },
    { feature: 'marks.enter', expected: role === 'teacher' },
    { feature: 'marks.approve', expected: role === 'school_admin' },
    { feature: 'students.create', expected: ['super_admin', 'school_admin'].includes(role) },
  ];
  
  tests.forEach(test => {
    const result = hasFeatureAccess(role, test.feature);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.feature}: ${result}`);
  });
  
  console.groupEnd();
});
```

### Scenario 2: Test Access Boundaries

```javascript
// Verify full vs read-only access
console.group('📊 Access Level Verification');

const tests = [
  { role: 'super_admin', feature: 'schools.view', expectedLevel: 'full' },
  { role: 'school_admin', feature: 'schools.view', expectedLevel: 'read-only' },
  { role: 'teacher', feature: 'schools.view', expectedLevel: 'none' },
  { role: 'student', feature: 'marks.view_own', expectedLevel: 'full' },
];

tests.forEach(test => {
  const level = getFeatureAccessLevel(test.role, test.feature);
  const status = level === test.expectedLevel ? '✅' : '❌';
  console.log(`${status} ${test.role} → ${test.feature}: ${level}`);
});

console.groupEnd();
```

### Scenario 3: Run Standard Test Suite

```javascript
// Execute built-in test suite
console.group('🧪 RBAC Standard Test Suite');

const results = runAllTests();
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`  ✅ Passed: ${results.passed}`);
console.log(`  ❌ Failed: ${results.failed}`);

results.results.forEach(result => {
  const status = (result.shouldPass.length === 0 && result.shouldFail.length === 0) ? '✅' : '❌';
  console.log(`\n${status} ${result.testCase.role}`);
  
  if (result.shouldPass.length > 0) {
    console.error('  Missing access:', result.shouldPass);
  }
  if (result.shouldFail.length > 0) {
    console.error('  Unexpected access:', result.shouldFail);
  }
});

console.groupEnd();
```

### Scenario 4: Generate Test Report

```javascript
// Export detailed test report
const report = exportTestReport();

console.group('📋 Test Report');
console.log(`Timestamp: ${report.timestamp}`);
console.log(`Passed: ${report.totalPassed}`);
console.log(`Failed: ${report.totalFailed}`);

console.log('\n📊 Access Summary:');
console.table(report.accessSummary);

console.log('\n📝 Detailed Results:');
console.table(report.detailedResults);

console.groupEnd();

// Download as JSON
const json = JSON.stringify(report, null, 2);
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
console.log(`\n📥 Report link: ${url}`);
```

### Scenario 5: Feature Verification

```javascript
// Verify specific features are configured correctly
const featuresToCheck = [
  'schools.create',
  'marks.enter',
  'attendance.record',
  'students.view',
  'analytics.view',
];

console.group('✔️ Feature Configuration Check');

featuresToCheck.forEach(feature => {
  const config = verifyFeatureConfiguration?.(feature);
  console.log(`\n${feature}:`);
  console.log(`  Configured: ${config.configured ? '✅' : '❌'}`);
  console.table(config.byRole);
});

console.groupEnd();
```

---

## Debugging Commands

### Debug Module Access Issue

```javascript
// When a module isn't accessible, debug why
function debugModuleAccess(moduleId) {
  console.group(`🐛 Debug: ${moduleId}`);
  
  const module = getModuleConfig?.(moduleId);
  if (!module) {
    console.error('Module not found in registry');
    console.groupEnd();
    return;
  }
  
  console.log('Module Config:', module);
  console.log(`Allowed Roles: ${module.allowedRoles.join(', ')}`);
  console.log(`Required Feature: ${module.feature}`);
  console.log(`Required Level: ${module.requiredLevel}`);
  
  const currentRole = profile?.role;
  console.log(`\nCurrent User Role: ${currentRole}`);
  console.log(`Role allowed? ${module.allowedRoles.includes(currentRole)}`);
  console.log(`Feature access? ${can(module.feature, module.requiredLevel)}`);
  
  const accessCheck = canAccessModule(moduleId);
  console.log(`\nFinal Result: ${accessCheck.canAccess ? '✅ CAN ACCESS' : '❌ CANNOT ACCESS'}`);
  console.log(`Reason: ${accessCheck.reason}`);
  
  console.groupEnd();
}

// Usage:
debugModuleAccess('students')
debugModuleAccess('schools')
debugModuleAccess('exam-marks')
```

### Debug Feature Access Issue

```javascript
// When a feature isn't accessible, debug why
function debugFeatureAccess(feature) {
  console.group(`🐛 Debug Feature: ${feature}`);
  
  const role = profile?.role;
  console.log(`User Role: ${role}`);
  
  const accessLevel = getFeatureAccessLevel(role, feature);
  console.log(`Access Level: ${accessLevel}`);
  
  const canRead = hasFeatureAccess(role, feature, 'read-only');
  const canWrite = hasFeatureAccess(role, feature, 'full');
  
  console.log(`Can Read? ${canRead ? '✅' : '❌'}`);
  console.log(`Can Write? ${canWrite ? '✅' : '❌'}`);
  
  // Check all roles for this feature
  console.log('\nAccess by all roles:');
  ['super_admin', 'school_admin', 'teacher', 'student', 'guardian'].forEach(r => {
    const level = getFeatureAccessLevel(r, feature);
    console.log(`  ${r}: ${level}`);
  });
  
  console.groupEnd();
}

// Usage:
debugFeatureAccess('marks.enter')
debugFeatureAccess('schools.create')
debugFeatureAccess('students.view')
```

---

## Common Test Patterns

### Pattern 1: Feature Matrix for Role

```javascript
// Show what a role can do
function showRoleFeatures(role) {
  console.group(`👤 ${role} Permissions`);
  
  const features = getAccessibleFeatures?.(role);
  
  const summary = { full: [], readOnly: [], none: [] };
  
  features?.forEach(f => {
    const level = getFeatureAccessLevel(role, f);
    if (level === 'full') summary.full.push(f);
    else if (level === 'read-only') summary.readOnly.push(f);
  });
  
  console.log(`\n✏️ Full Access (${summary.full.length}):`);
  summary.full.slice(0, 10).forEach(f => console.log(`  • ${f}`));
  if (summary.full.length > 10) console.log(`  ... and ${summary.full.length - 10} more`);
  
  console.log(`\n👁️ Read-Only (${summary.readOnly.length}):`);
  summary.readOnly.slice(0, 10).forEach(f => console.log(`  • ${f}`));
  if (summary.readOnly.length > 10) console.log(`  ... and ${summary.readOnly.length - 10} more`);
  
  console.groupEnd();
}

// Usage:
showRoleFeatures('super_admin');
showRoleFeatures('teacher');
showRoleFeatures('student');
```

### Pattern 2: Check Module Visibility

```javascript
// Show which modules are visible in sidebar
function showVisibleModules() {
  console.group('🎯 Visible Modules');
  
  const allModules = [
    'dashboard', 'students', 'teachers', 'classes', 'subjects',
    'attendance', 'exams', 'exam-marks', 'timetable', 'schools',
    'users', 'reports', 'settings', 'analytics'
  ];
  
  console.log(`Current Role: ${profile?.role}\n`);
  
  allModules.forEach(module => {
    const access = canAccessModule(module);
    const icon = access.canAccess ? '✅' : '❌';
    console.log(`${icon} ${module}`);
  });
  
  console.groupEnd();
}

showVisibleModules();
```

### Pattern 3: Compare Two Roles

```javascript
// Compare what two roles can do
function compareRoles(role1, role2) {
  console.group(`⚖️ Compare ${role1} vs ${role2}`);
  
  const features1 = new Set(getAccessibleFeatures?.(role1) || []);
  const features2 = new Set(getAccessibleFeatures?.(role2) || []);
  
  const onlyRole1 = [...features1].filter(f => !features2.has(f));
  const onlyRole2 = [...features2].filter(f => !features1.has(f));
  const shared = [...features1].filter(f => features2.has(f));
  
  console.log(`\nOnly ${role1} (${onlyRole1.length}):`);
  onlyRole1.slice(0, 5).forEach(f => console.log(`  • ${f}`));
  
  console.log(`\nOnly ${role2} (${onlyRole2.length}):`);
  onlyRole2.slice(0, 5).forEach(f => console.log(`  • ${f}`));
  
  console.log(`\nShared (${shared.length}):`);
  shared.slice(0, 5).forEach(f => console.log(`  • ${f}`));
  
  console.groupEnd();
}

// Usage:
compareRoles('super_admin', 'school_admin');
compareRoles('teacher', 'student');
compareRoles('school_admin', 'teacher');
```

---

## Verification Checklist Commands

**Copy these commands one-by-one to verify the system:**

```javascript
// 1. Check current user
console.assert(profile?.role, '❌ No profile');
console.log('✅ User profile loaded');

// 2. Check if super_admin has schools access
console.assert(hasFeatureAccess('super_admin', 'schools.create'), '❌ Super admin no school access');
console.log('✅ Super admin has schools.create');

// 3. Check if school_admin doesn't have schools.create
console.assert(!hasFeatureAccess('school_admin', 'schools.create'), '❌ School admin has schools.create');
console.log('✅ School admin blocked from schools.create');

// 4. Check if teacher can enter marks
console.assert(hasFeatureAccess('teacher', 'marks.enter', 'full'), '❌ Teacher can\\'t enter marks');
console.log('✅ Teacher can enter marks');

// 5. Check if student can\\'t enter marks
console.assert(!hasFeatureAccess('student', 'marks.enter'), '❌ Student can enter marks');
console.log('✅ Student blocked from entering marks');

// 6. Check module access for current user
const studentModules = canAccessModule('students');
const schoolModules = canAccessModule('schools');
console.log('✅ Module checks:', { 'students': studentModules.canAccess, 'schools': schoolModules.canAccess });

// 7. Run full test suite
const testResults = runAllTests?.();
console.assert(testResults.failed === 0, `❌ ${testResults.failed} tests failed`);
console.log(`✅ All tests passed (${testResults.passed})`);
```

---

## Export & Share Results

### Export Test Results as JSON

```javascript
// Get complete test report and copy to clipboard
const report = exportTestReport();
const json = JSON.stringify(report, null, 2);
copy(json);
console.log('✅ Report copied to clipboard!');
console.log(json);
```

### Export Access Summary as Table

```javascript
// Get summary and display as table
const summary = generateAccessSummary();
console.table(summary);
```

### Log Everything (Verbose Mode)

```javascript
// Full verbose logging with all details
logTestResults?.(true);
```

---

## Useful Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| F12 | Open DevTools |
| F12 → Console tab | Go to Console |
| Ctrl+L (Cmd+K) | Clear Console |
| ↑ | Cycle through command history |
| Ctrl+Shift+K | Clear Console (Chrome) |

---

## Tips & Tricks

### 1. Store Results in Variable
```javascript
// Save test results for analysis
const results = runAllTests();
const summary = generateAccessSummary();
```

### 2. Filter Console Output
```javascript
// Only show failed tests
runAllTests().results.filter(r => 
  r.shouldPass.length > 0 || r.shouldFail.length > 0
);
```

### 3. Copy to Clipboard
```javascript
// Copy JSON results to clipboard for sharing
copy(exportTestReport());
```

### 4. Create Test Report File
```javascript
// Download test report as file
const report = exportTestReport();
const json = JSON.stringify(report, null, 2);
const element = document.createElement('a');
element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(json));
element.setAttribute('download', 'rbac-test-report.json');
element.style.display = 'none';
document.body.appendChild(element);
element.click();
document.body.removeChild(element);
```

---

## Troubleshooting

### Functions Not Defined?

```javascript
// Make sure these are accessible:
typeof hasFeatureAccess           // Should be 'function'
typeof getFeatureAccessLevel      // Should be 'function'
typeof canAccessModule            // Should be 'function'
typeof runAllTests                // Should be 'function'
typeof generateAccessSummary      // Should be 'function'

// If not defined, they may not be exported.
// Check that rbac-testing.ts functions are available in global scope.
```

### Permission Denied?

```javascript
// Check current user role
console.log('Current role:', profile?.role);

// Test if role has feature access
console.log(hasFeatureAccess(profile?.role, 'desired_feature'));
```

### Module Not Found?

```javascript
// Check if module exists
const module = getModuleConfig?.('module-id');
console.log('Module found:', !!module);

// Get all available modules
const accessible = getModulesByRole?.(profile?.role);
console.log('Accessible modules:', accessible);
```

---

## Reference

**Test Functions Available in rbac-testing.ts**:
- `runAllTests()` - Execute all test cases
- `generateAccessSummary()` - Get feature distribution stats
- `exportTestReport()` - Export complete JSON report
- `logTestResults(verbose)` - Log formatted results
- `verifyFeatureConfiguration(feature)` - Check feature setup

**Access Control Functions**:
- `hasFeatureAccess(role, feature, level)` - Check permission
- `getFeatureAccessLevel(role, feature)` - Get access level
- `getAccessibleFeatures(role)` - List all accessible features
- `canAccessModule(moduleId)` - Check module access

---

**Last Updated**: March 23, 2026  
**Status**: Ready to Use  
**For Full Testing Plan**: See E2E_TESTING_PLAN.md

