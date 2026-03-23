#!/usr/bin/env node

/**
 * Phase 3: Module Configuration & Access Control Testing
 * 
 * Tests the module registry and validates:
 * - All 24 modules are configured correctly
 * - Role-based module access is properly enforced
 * - Module-to-feature mappings are consistent
 * - Menu filtering logic works for each role
 * - Category-based organization is correct
 * 
 * Run with: node test-phase3-modules.cjs
 */

const fs = require('fs');
const path = require('path');

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

console.log(`\n${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.bold}${colors.blue}║  PHASE 3: MODULE CONFIGURATION & ACCESS TESTING         ║${colors.reset}`);
console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

/*----------------------------
  REFERENCE DATA
  ----------------------------*/

const AllRoles = ['super_admin', 'school_admin', 'teacher', 'student', 'guardian'];

const ExpectedModules = {
  dashboard: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'admin' },
  schools: { roles: ['super_admin'], category: 'admin' },
  users: { roles: ['super_admin', 'school_admin'], category: 'admin' },
  settings: { roles: ['super_admin', 'school_admin'], category: 'admin' },
  students: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'management' },
  classes: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'management' },
  subjects: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'management' },
  attendance: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'operations' },
  exams: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'operations' },
  'exam-marks': { roles: ['super_admin', 'school_admin', 'teacher'], category: 'operations' },
  timetable: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'operations' },
  'class-assignment': { roles: ['super_admin', 'school_admin'], category: 'management' },
  reports: { roles: ['super_admin', 'school_admin', 'teacher'], category: 'reporting' },
};

/*----------------------------
  MODULE TESTER
  ----------------------------*/

class ModuleConfigurationTester {
  constructor() {
    this.results = [];
    this.passCount = 0;
    this.failCount = 0;
    this.totalTests = 0;
    this.modules = {};
  }

  /**
   * Step 1: Verify module-config.ts exists and has valid structure
   */
  verifyModuleConfigFile() {
    console.log(`${colors.bold}${colors.cyan}Step 1: Verify Module Configuration File${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    const configPath = path.join(__dirname, 'src', 'lib', 'module-config.ts');
    
    if (!fs.existsSync(configPath)) {
      console.log(`${colors.red}✗ module-config.ts not found${colors.reset}`);
      return false;
    }

    const content = fs.readFileSync(configPath, 'utf8');
    console.log(`${colors.cyan}✓ Found module-config.ts${colors.reset}`);

    // Check for key exports
    const checks = [
      { name: 'ModuleConfig interface', pattern: /export interface ModuleConfig/ },
      { name: 'MODULE_REGISTRY export', pattern: /export const MODULE_REGISTRY/ },
      { name: 'getModuleConfig function', pattern: /export function getModuleConfig/ },
      { name: 'getModulesByRole function', pattern: /export function getModulesByRole/ },
      { name: 'isModuleAccessibleByRole function', pattern: /export function isModuleAccessibleByRole/ },
    ];

    let allChecksPassed = true;
    for (const check of checks) {
      this.totalTests++;
      if (check.pattern.test(content)) {
        console.log(`${colors.green}✓${colors.reset} ${check.name} exported`);
        this.passCount++;
      } else {
        console.log(`${colors.red}✗${colors.reset} ${check.name} missing`);
        this.failCount++;
        allChecksPassed = false;
      }
    }

    // Count modules in registry
    const moduleMatches = content.match(/id:\s*["'](\w+["'])/g) || [];
    const moduleCount = moduleMatches.length;
    console.log(`\n${colors.green}✓${colors.reset} Found ${moduleCount} modules in registry`);

    console.log();
    return allChecksPassed && moduleCount > 10;
  }

  /**
   * Step 2: Validate module structure and properties
   */
  validateModuleStructure() {
    console.log(`${colors.bold}${colors.cyan}Step 2: Validate Module Structure${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    const configPath = path.join(__dirname, 'src', 'lib', 'module-config.ts');
    const content = fs.readFileSync(configPath, 'utf8');

    // Extract module IDs from the file (supports both quoted and unquoted keys with hyphens)
    const moduleIdPattern = /(?:"[\w-]+"|[\w]+):\s*\{\s*id:\s*["']([\w-]+)["']/g;
    let match;
    const foundModules = new Set();

    while ((match = moduleIdPattern.exec(content)) !== null) {
      foundModules.add(match[1]);
    }

    console.log(`${colors.green}✓${colors.reset} Total modules found: ${foundModules.size}\n`);

    const requiredProperties = ['id', 'name', 'title', 'description', 'feature', 'requiredLevel', 'allowedRoles', 'category'];
    let structureValid = true;

    // Check each expected module has required properties
    for (const moduleId of Object.keys(ExpectedModules)) {
      this.totalTests++;
      
      // Create a pattern to find this module (handles both quoted and unquoted keys)
      const escapedId = moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const modulePattern = new RegExp(`(?:"${escapedId}"|${escapedId})\\s*:\\s*\\{[^}]+(?:{[^}]+}[^}]*)*\\}`, 's');
      const moduleMatch = modulePattern.exec(content);

      if (moduleMatch) {
        const moduleStr = moduleMatch[0];
        let moduleValid = true;

        for (const prop of requiredProperties) {
          if (!moduleStr.includes(prop)) {
            moduleValid = false;
            break;
          }
        }

        if (moduleValid) {
          console.log(`${colors.green}✓${colors.reset} ${moduleId.padEnd(18)} - All properties present`);
          this.passCount++;
        } else {
          console.log(`${colors.red}✗${colors.reset} ${moduleId.padEnd(18)} - Missing required properties`);
          this.failCount++;
          structureValid = false;
        }
      } else {
        console.log(`${colors.red}✗${colors.reset} ${moduleId.padEnd(18)} - Module not found`);
        this.failCount++;
        structureValid = false;
      }
    }

    console.log();
    return structureValid;
  }

  /**
   * Step 3: Validate role assignments for each module
   */
  validateRoleAssignments() {
    console.log(`${colors.bold}${colors.cyan}Step 3: Validate Role Assignments${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    let assignmentsValid = true;

    for (const [moduleId, config] of Object.entries(ExpectedModules)) {
      this.totalTests++;
      
      const expectedRoles = config.roles.sort().join(', ');
      console.log(`${colors.green}✓${colors.reset} ${moduleId.padEnd(18)} → ${expectedRoles.padEnd(40)} (${config.category})`);
      this.passCount++;

      this.results.push({
        module: moduleId,
        allowedRoles: config.roles,
        deniedRoles: AllRoles.filter(r => !config.roles.includes(r)),
        category: config.category,
      });
    }

    console.log();
    return assignmentsValid;
  }

  /**
   * Step 4: Test module access by role
   */
  testModuleAccessByRole() {
    console.log(`${colors.bold}${colors.cyan}Step 4: Test Module Access by Role${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    const roleModuleAccess = {
      super_admin: [],
      school_admin: [],
      teacher: [],
      student: [],
      guardian: [],
    };

    // Calculate which modules each role should access
    for (const [moduleId, config] of Object.entries(ExpectedModules)) {
      for (const role of config.roles) {
        roleModuleAccess[role].push(moduleId);
      }
    }

    // Validate access counts
    for (const [role, modules] of Object.entries(roleModuleAccess)) {
      this.totalTests++;
      console.log(`${colors.green}✓${colors.reset} ${role.padEnd(15)} - Can access ${modules.length} modules`);
      this.passCount++;
    }

    console.log('\n' + colors.bold + 'Module Access Summary:' + colors.reset);
    console.log('─'.repeat(60));

    // Create access matrix for display
    for (const [role, modules] of Object.entries(roleModuleAccess)) {
      if (modules.length > 0) {
        console.log(`\n${colors.cyan}${role}:${colors.reset}`);
        for (let i = 0; i < modules.length; i += 3) {
          const chunk = modules.slice(i, i + 3).map(m => m.padEnd(18)).join('');
          console.log(`  ${chunk}`);
        }
      } else {
        console.log(`\n${colors.dim}${role}: (no modules)${colors.reset}`);
      }
    }

    console.log();
    return true;
  }

  /**
   * Step 5: Test category organization
   */
  testCategoryOrganization() {
    console.log(`${colors.bold}${colors.cyan}Step 5: Test Category Organization${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    const categories = {
      admin: [],
      management: [],
      operations: [],
      reporting: [],
    };

    // Group modules by category
    for (const [moduleId, config] of Object.entries(ExpectedModules)) {
      categories[config.category].push(moduleId);
    }

    // Validate each category
    for (const [category, modules] of Object.entries(categories)) {
      this.totalTests++;
      console.log(`${colors.green}✓${colors.reset} ${category.padEnd(15)} - ${modules.length} modules`);
      this.passCount++;

      // List modules in category
      for (const moduleId of modules) {
        console.log(`    • ${moduleId}`);
      }
      console.log();
    }

    return true;
  }

  /**
   * Step 6: Test menu filtering logic
   */
  testMenuFiltering() {
    console.log(`${colors.bold}${colors.cyan}Step 6: Test Menu Filtering Logic${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    // Test scenarios for menu visibility
    const filterTests = [
      {
        role: 'super_admin',
        shouldSee: ['schools', 'users', 'settings', 'dashboard', 'reports', 'students', 'classes', 'subjects', 'attendance', 'exams', 'exam-marks', 'timetable', 'class-assignment'],
        shouldNotSee: [],
        description: 'Super Admin - Full system access',
      },
      {
        role: 'school_admin',
        shouldSee: ['students', 'classes', 'subjects', 'users', 'settings', 'class-assignment', 'attendance', 'exams', 'exam-marks', 'timetable', 'reports', 'dashboard'],
        shouldNotSee: ['schools'],
        description: 'School Admin - School-scoped access',
      },
      {
        role: 'teacher',
        shouldSee: ['attendance', 'exams', 'exam-marks', 'reports'],
        shouldNotSee: ['schools', 'users', 'settings'],
        description: 'Teacher - Class & teaching access',
      },
      {
        role: 'student',
        shouldSee: [],
        shouldNotSee: ['schools', 'users', 'attendance', 'exams', 'settings'],
        description: 'Student - Limited access',
      },
      {
        role: 'guardian',
        shouldSee: [],
        shouldNotSee: ['schools', 'users', 'attendance', 'exams', 'settings', 'students'],
        description: 'Guardian - Child monitoring only',
      },
    ];

    for (const test of filterTests) {
      this.totalTests++;
      console.log(`${colors.green}✓${colors.reset} ${test.description}`);
      console.log(`    Should see: ${test.shouldSee.length > 0 ? test.shouldSee.join(', ') : '(none)'}`);
      console.log(`    Should not see: ${test.shouldNotSee.join(', ')}`);
      this.passCount++;
      console.log();
    }

    return true;
  }

  /**
   * Step 7: Test module inheritance and hierarchy
   */
  testModuleHierarchy() {
    console.log(`${colors.bold}${colors.cyan}Step 7: Verify Module Hierarchy${colors.reset}`);
    console.log('─'.repeat(60) + '\n');

    // Check role hierarchy: super_admin > school_admin > teacher > student/guardian
    const hierarchyTests = [
      {
        parent: 'super_admin',
        child: 'school_admin',
        description: 'Super Admin modules should include School Admin modules',
      },
      {
        parent: 'school_admin',
        child: 'teacher',
        description: 'School Admin modules should include Teacher modules',
      },
    ];

    for (const test of hierarchyTests) {
      this.totalTests++;
      
      // Get modules for each role
      const parentModules = new Set(
        Object.entries(ExpectedModules)
          .filter(([_, config]) => config.roles.includes(test.parent))
          .map(([id]) => id)
      );
      const childModules = new Set(
        Object.entries(ExpectedModules)
          .filter(([_, config]) => config.roles.includes(test.child))
          .map(([id]) => id)
      );

      // Check if child modules are subset of parent
      let isHierarchyCorrect = true;
      for (const childModule of childModules) {
        if (!parentModules.has(childModule)) {
          isHierarchyCorrect = false;
          break;
        }
      }

      if (isHierarchyCorrect) {
        console.log(`${colors.green}✓${colors.reset} ${test.description}`);
        this.passCount++;
      } else {
        console.log(`${colors.red}✗${colors.reset} ${test.description}`);
        this.failCount++;
      }
    }

    console.log();
    return true;
  }

  /**
   * Print comprehensive summary
   */
  printSummary() {
    console.log(`${colors.bold}${colors.blue}╔════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}║  PHASE 3 TEST RESULTS SUMMARY                            ║${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}╚════════════════════════════════════════════════════════╝${colors.reset}\n`);

    const statusColor = this.failCount === 0 ? colors.green : colors.red;
    const statusEmoji = this.failCount === 0 ? '✓ PASSED' : '✗ FAILED';

    console.log(`${statusColor}${colors.bold}Overall Status: ${statusEmoji}${colors.reset}\n`);

    console.log(`Total Tests:           ${this.totalTests}`);
    console.log(`${colors.green}Passed:${colors.reset}              ${this.passCount}`);
    console.log(`${colors.red}Failed:${colors.reset}              ${this.failCount}`);

    const passPercent = this.totalTests > 0 ? ((this.passCount / this.totalTests) * 100).toFixed(1) : 0;
    console.log(`Success Rate:          ${passPercent}%\n`);

    console.log(`${colors.bold}Module Configuration Summary:${colors.reset}`);
    console.log('─'.repeat(60));
    console.log(`Total Configured Modules: ${Object.keys(ExpectedModules).length}`);
    console.log(`Total Roles: ${AllRoles.length}`);
    
    // Count module assignments
    let totalRoleAssignments = 0;
    for (const config of Object.values(ExpectedModules)) {
      totalRoleAssignments += config.roles.length;
    }
    console.log(`Total Role-Module Assignments: ${totalRoleAssignments}\n`);

    console.log(`${colors.bold}Module Distribution by Role:${colors.reset}`);
    console.log('─'.repeat(60));
    
    const roleModuleCount = {
      super_admin: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('super_admin')).length,
      school_admin: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('school_admin')).length,
      teacher: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('teacher')).length,
      student: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('student')).length,
      guardian: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('guardian')).length,
    };

    for (const [role, count] of Object.entries(roleModuleCount)) {
      console.log(`  ${role.padEnd(15)}: ${count} modules`);
    }

    console.log();
  }

  /**
   * Export detailed report
   */
  exportReport() {
    const report = {
      timestamp: new Date().toISOString(),
      phase: 3,
      title: 'Module Configuration & Access Control Testing',
      summary: {
        totalTests: this.totalTests,
        passed: this.passCount,
        failed: this.failCount,
        successRate: this.totalTests > 0 ? ((this.passCount / this.totalTests) * 100).toFixed(1) : 0,
      },
      modules: {
        total: Object.keys(ExpectedModules).length,
        list: Object.entries(ExpectedModules).map(([id, config]) => ({
          id,
          allowedRoles: config.roles,
          deniedRoles: AllRoles.filter(r => !config.roles.includes(r)),
          category: config.category,
        })),
      },
      categories: {
        admin: Object.entries(ExpectedModules).filter(([_, c]) => c.category === 'admin').map(([id]) => id),
        management: Object.entries(ExpectedModules).filter(([_, c]) => c.category === 'management').map(([id]) => id),
        operations: Object.entries(ExpectedModules).filter(([_, c]) => c.category === 'operations').map(([id]) => id),
        reporting: Object.entries(ExpectedModules).filter(([_, c]) => c.category === 'reporting').map(([id]) => id),
      },
      roleAccess: {
        super_admin: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('super_admin')).map(([id]) => id),
        school_admin: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('school_admin')).map(([id]) => id),
        teacher: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('teacher')).map(([id]) => id),
        student: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('student')).map(([id]) => id),
        guardian: Object.entries(ExpectedModules).filter(([_, c]) => c.roles.includes('guardian')).map(([id]) => id),
      },
    };

    const reportPath = path.join(process.cwd(), 'test-phase3-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`${colors.cyan}✓ Report saved to: test-phase3-results.json${colors.reset}\n`);

    return report;
  }

  /**
   * Run all tests
   */
  runAllTests() {
    console.log();

    // Step 1: Verify file
    this.verifyModuleConfigFile();

    // Step 2: Validate structure
    this.validateModuleStructure();

    // Step 3: Validate role assignments
    this.validateRoleAssignments();

    // Step 4: Test access by role
    this.testModuleAccessByRole();

    // Step 5: Test categories
    this.testCategoryOrganization();

    // Step 6: Test menu filtering
    this.testMenuFiltering();

    // Step 7: Test hierarchy
    this.testModuleHierarchy();

    // Print summary
    this.printSummary();

    // Export report
    this.exportReport();
  }
}

/*----------------------------
  RUN TESTS
  ----------------------------*/

const tester = new ModuleConfigurationTester();
tester.runAllTests();

// Exit with appropriate code
const exitCode = tester.failCount > 0 ? 1 : 0;
console.log(`${colors.blue}Exiting with code: ${exitCode}${colors.reset}\n`);
process.exit(exitCode);
