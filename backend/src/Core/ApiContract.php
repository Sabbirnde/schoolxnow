<?php

declare(strict_types=1);

namespace SchoolXNow\Core;

use RuntimeException;

final class ApiContract
{
    private static ?array $contract = null;

    public static function get(): array
    {
        if (self::$contract !== null) {
            return self::$contract;
        }

        $path = dirname(__DIR__, 2) . '/api-contract.json';
        $content = file_get_contents($path);
        $decoded = $content === false ? null : json_decode($content, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Shared API contract is missing or invalid.');
        }

        self::$contract = $decoded;
        return self::$contract;
    }

    public static function allowedTables(): array
    {
        return self::get()['tables']['allowed'];
    }

    public static function schoolScopedTables(): array
    {
        return self::get()['tables']['schoolScoped'];
    }

    public static function allows(string $role, string $table, string $operation): bool
    {
        $policy = self::get()['authorization'][$role] ?? null;
        if (!is_array($policy)) {
            return false;
        }
        if (isset($policy['overrides'][$table])) {
            return in_array($operation, $policy['overrides'][$table], true);
        }
        if (isset($policy['all'])) {
            return in_array($operation, $policy['all'], true);
        }
        if (in_array($table, $policy['appendOnly'] ?? [], true)) {
            return $operation === 'create' || ($role === 'school_admin' && $operation === 'read');
        }

        $tables = $operation === 'read' ? ($policy['read'] ?? []) : ($policy['write'] ?? []);
        return in_array($table, $tables, true);
    }
}
