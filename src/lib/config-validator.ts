// Configuration validation utility.
// This file provides helper functions for validating and debugging configuration.
import SecureConfig from './secure-config';

/**
 * Checks all environment variables and returns a validation report.
 * Sensitive values are masked/redacted in the report.
 */
export function validateEnvironmentVariables(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: Record<string, string>;
} {
  const validation = SecureConfig.validate();

  return {
    valid: validation.isValid,
    errors: validation.errors,
    warnings: [],
    info: validation.safeInfo,
  };
}

/**
 * Prints a formatted configuration report to console.
 * Sensitive values are never printed.
 */
export function printConfigurationReport(): void {
  const report = validateEnvironmentVariables();

  console.group('Secure Configuration Report');

  if (report.valid) {
    console.log('Configuration is valid');
  } else {
    console.error('Configuration has errors');
  }

  if (report.errors.length > 0) {
    console.group('Errors');
    report.errors.forEach((error) => console.error(`  - ${error}`));
    console.groupEnd();
  }

  if (report.warnings.length > 0) {
    console.group('Warnings');
    report.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    console.groupEnd();
  }

  if (Object.keys(report.info).length > 0) {
    console.group('Safe Information');
    Object.entries(report.info).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.groupEnd();
  }

  console.groupEnd();

  if (!report.valid) {
    console.log('\nQuick fix: Copy .env.example to .env and fill in your values.');
    console.log('PHP backend mode requires VITE_API_URL.');
    console.log('Security: Credentials are never exposed in logs.');
  }
}

/**
 * Diagnostic function to help troubleshoot configuration issues.
 * Sensitive values are never logged.
 */
export function diagnoseConfiguration(): void {
  console.group('Secure Configuration Diagnostics');

  const allEnvVars = Object.keys(import.meta.env).filter((key) => key.startsWith('VITE_'));
  console.log(`Found ${allEnvVars.length} VITE_ environment variables`);

  if (allEnvVars.length === 0) {
    console.error('No VITE_ variables found.');
    console.error('This usually means:');
    console.error('  1. No .env file exists in the project root');
    console.error('  2. The .env file is not formatted correctly');
    console.error('  3. The dev server needs to be restarted');
  } else {
    console.log('Available VITE_ variables:', allEnvVars);
  }

  console.log('\nBackend Provider: php');
  console.log('PHP API Configuration Status:');
  console.log(`  VITE_API_URL: ${import.meta.env.VITE_API_URL ? 'Set' : 'Missing'}`);

  console.log('\nFull Validation Report:');
  printConfigurationReport();

  console.log('\nSecurity note: All credential values are masked in logs.');
  console.groupEnd();
}

if (import.meta.env.DEV) {
  const report = validateEnvironmentVariables();
  if (!report.valid) {
    console.error('\nConfiguration issues detected.');
    diagnoseConfiguration();
  }
}
