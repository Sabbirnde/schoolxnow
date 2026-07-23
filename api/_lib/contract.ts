import contract from '../../backend/api-contract.json' with { type: 'json' };
import type { TableOperation } from './auth.js';

type RolePolicy = {
  all?: TableOperation[];
  overrides?: Record<string, TableOperation[]>;
  read?: string[];
  write?: string[];
  appendOnly?: string[];
};

export const allowedTables = contract.tables.allowed;
export const schoolScopedTables = contract.tables.schoolScoped;

export function contractAllows(role: string, table: string, operation: TableOperation) {
  const policy = (contract.authorization as Record<string, RolePolicy>)[role];
  if (!policy) {
    return false;
  }
  const override = policy.overrides?.[table];
  if (override) {
    return override.includes(operation);
  }
  if (policy.all) {
    return policy.all.includes(operation);
  }
  if (policy.appendOnly?.includes(table)) {
    return operation === 'create' || (role === 'school_admin' && operation === 'read');
  }
  return operation === 'read'
    ? Boolean(policy.read?.includes(table))
    : Boolean(policy.write?.includes(table));
}

export default contract;
