import fs from 'node:fs';
import path from 'node:path';

const contractPath = path.resolve('backend/api-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const failures = [];
const operations = new Set(['read', 'create', 'update', 'delete']);
const allowed = new Set(contract.tables?.allowed ?? []);

if (!/^\d+\.\d+\.\d+$/.test(contract.version ?? '')) failures.push('version must use semantic versioning');
if (!['node', 'php'].includes(contract.primaryBackend)) failures.push('primaryBackend must be node or php');
if (!contract.basePath?.startsWith('/')) failures.push('basePath must start with /');
if (!contract.requestIdHeader) failures.push('requestIdHeader is required');

const endpointKeys = new Set();
for (const endpoint of contract.endpoints ?? []) {
  for (const method of endpoint.methods ?? []) {
    const key = `${method} ${endpoint.path}`;
    if (endpointKeys.has(key)) failures.push(`duplicate endpoint: ${key}`);
    endpointKeys.add(key);
  }
  if (!contract.envelopes?.[endpoint.envelope]) failures.push(`unknown envelope: ${endpoint.envelope}`);
}

for (const table of contract.tables?.schoolScoped ?? []) {
  if (!allowed.has(table)) failures.push(`school-scoped table is not allowed: ${table}`);
}

for (const role of ['super_admin', 'school_admin', 'teacher', 'student', 'guardian']) {
  const policy = contract.authorization?.[role];
  if (!policy) {
    failures.push(`missing authorization policy: ${role}`);
    continue;
  }
  for (const operation of policy.all ?? []) {
    if (!operations.has(operation)) failures.push(`invalid operation for ${role}: ${operation}`);
  }
  for (const group of ['read', 'write', 'appendOnly']) {
    for (const table of policy[group] ?? []) {
      if (!allowed.has(table)) failures.push(`${role}.${group} references unknown table: ${table}`);
    }
  }
}

if (failures.length) {
  console.error(`API contract validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `API contract ${contract.version} is valid: ${endpointKeys.size} operations, ${allowed.size} tables, ` +
  `${Object.keys(contract.authorization).length} roles; primary backend=${contract.primaryBackend}.`,
);
