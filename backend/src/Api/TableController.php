<?php

declare(strict_types=1);

namespace SchoolXNow\Api;

use SchoolXNow\Core\ApiContract;
use SchoolXNow\Core\Database;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;
use SchoolXNow\Security\Auth;

final class TableController
{
    public function index(string $table): void
    {
        $table = $this->assertTable($table);
        $user = Auth::user();
        $this->requireAccess($user, $table, 'read');
        $params = [];
        $where = $this->scopeWhere($table, $user, $params);
        $limit = min(max((int) ($_GET['limit'] ?? 50), 1), 200);
        $offset = max((int) ($_GET['offset'] ?? 0), 0);

        $this->appendFilters($where, $params);
        $orderBy = $this->orderBy();

        $sql = "SELECT * FROM {$table}" . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . " ORDER BY {$orderBy} LIMIT :limit OFFSET :offset";
        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        Response::json(['data' => $stmt->fetchAll()]);
    }

    public function show(string $table, string $id): void
    {
        $table = $this->assertTable($table);
        $user = Auth::user();
        $this->requireAccess($user, $table, 'read');
        $params = ['id' => $id];
        $where = ['id = :id', ...$this->scopeWhere($table, $user, $params)];

        $stmt = Database::connection()->prepare("SELECT * FROM {$table} WHERE " . implode(' AND ', $where) . ' LIMIT 1');
        $stmt->execute($params);
        $row = $stmt->fetch();

        if (!$row) {
            Response::json(['error' => ['message' => 'Record not found']], 404);
        }

        Response::json(['data' => $row]);
    }

    public function count(string $table): void
    {
        $table = $this->assertTable($table);
        $user = Auth::user();
        $this->requireAccess($user, $table, 'read');
        $params = [];
        $where = $this->scopeWhere($table, $user, $params);
        $this->appendFilters($where, $params);

        $sql = "SELECT COUNT(*) AS total FROM {$table}" . ($where ? ' WHERE ' . implode(' AND ', $where) : '');
        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(":{$key}", $value);
        }
        $stmt->execute();

        Response::json(['data' => ['count' => (int) ($stmt->fetch()['total'] ?? 0)]]);
    }

    public function store(string $table): void
    {
        $table = $this->assertTable($table);
        $user = Auth::user();

        $this->requireAccess($user, $table, 'create');

        $body = Request::json();
        $this->removeProtectedFields($body, $user);
        $body['id'] = $body['id'] ?? self::uuid();
        if (in_array($table, ApiContract::schoolScopedTables(), true) && $user['role'] !== 'super_admin') {
            $body['school_id'] = $user['school_id'];
        }
        if (in_array($table, ['notification_settings', 'feedback_submissions'], true) && $user['role'] !== 'super_admin') {
            $body['user_id'] = $user['id'];
        }
        if ($table === 'audit_logs' && $user['role'] !== 'super_admin') {
            $body['user_id'] = $user['id'];
        }

        $this->insert($table, $body);
        Response::json(['data' => $body], 201);
    }

    public function update(string $table, string $id): void
    {
        $table = $this->assertTable($table);
        $user = Auth::user();

        $this->requireAccess($user, $table, 'update');

        $body = Request::json();
        $this->removeProtectedFields($body, $user);
        unset($body['id'], $body['created_at']);
        if (!$body) {
            Response::json(['error' => ['message' => 'No fields to update']], 422);
        }

        $params = ['id' => $id];
        $sets = [];
        foreach ($body as $key => $value) {
            if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $key)) {
                continue;
            }
            $sets[] = "{$key} = :{$key}";
            $params[$key] = $this->normalizeValue($value);
        }

        $where = ['id = :id', ...$this->scopeWhere($table, $user, $params)];
        $sql = "UPDATE {$table} SET " . implode(', ', $sets) . ' WHERE ' . implode(' AND ', $where);
        Database::connection()->prepare($sql)->execute($params);

        $this->show($table, $id);
    }

    public function destroy(string $table, string $id): void
    {
        $table = $this->assertTable($table);
        $user = Auth::user();

        $this->requireAccess($user, $table, 'delete');

        $params = ['id' => $id];
        $where = ['id = :id', ...$this->scopeWhere($table, $user, $params)];
        Database::connection()->prepare("DELETE FROM {$table} WHERE " . implode(' AND ', $where))->execute($params);

        Response::noContent();
    }

    private function assertTable(string $table): string
    {
        if (!in_array($table, ApiContract::allowedTables(), true)) {
            Response::json(['error' => ['message' => 'Table is not available through API']], 404);
        }

        return $table;
    }

    private function scopeWhere(string $table, array $user, array &$params): array
    {
        if ($user['role'] === 'super_admin') {
            return [];
        }

        if ($table === 'schools') {
            $params['scope_school_id'] = $user['school_id'];
            return ['id = :scope_school_id'];
        }

        if ($table === 'user_profiles') {
            if ($user['role'] === 'school_admin') {
                $params['scope_school_id'] = $user['school_id'];
                return ['school_id = :scope_school_id'];
            }
            $params['scope_user_id'] = $user['id'];
            return ['user_id = :scope_user_id'];
        }

        if ($table === 'notifications') {
            $params['scope_school_id'] = $user['school_id'];
            if ($user['role'] === 'school_admin') {
                return ['school_id = :scope_school_id'];
            }

            $params['scope_user_id'] = $user['id'];
            return ['school_id = :scope_school_id', '(user_id IS NULL OR user_id = :scope_user_id)'];
        }

        if ($table === 'notification_settings') {
            $params['scope_school_id'] = $user['school_id'];
            $params['scope_user_id'] = $user['id'];
            return ['school_id = :scope_school_id', 'user_id = :scope_user_id'];
        }

        if ($table === 'feedback_submissions') {
            $params['scope_school_id'] = $user['school_id'];
            if ($user['role'] === 'school_admin') {
                return ['school_id = :scope_school_id'];
            }

            $params['scope_user_id'] = $user['id'];
            return ['school_id = :scope_school_id', 'user_id = :scope_user_id'];
        }

        if ($table === 'teacher_applications' && $user['role'] === 'teacher') {
            $params['scope_user_id'] = $user['id'];
            return ['user_id = :scope_user_id'];
        }

        if (in_array($table, ApiContract::schoolScopedTables(), true)) {
            $params['scope_school_id'] = $user['school_id'];
            return ['school_id = :scope_school_id'];
        }

        Response::json(['error' => ['message' => 'Forbidden']], 403);
    }

    private function requireAccess(array $user, string $table, string $operation): void
    {
        if (!Auth::canAccessTable($user, $table, $operation)) {
            Response::json(['error' => ['message' => 'Forbidden']], 403);
        }
    }

    private function removeProtectedFields(array &$body, array $user): void
    {
        if ($user['role'] !== 'super_admin') {
            unset($body['user_id'], $body['school_id'], $body['role']);
        }
    }

    private function appendFilters(array &$where, array &$params): void
    {
        foreach ($_GET as $key => $value) {
            if (in_array($key, ['limit', 'offset', 'sort', 'order'], true)) {
                continue;
            }

            if (!preg_match('/^([a-zA-Z_][a-zA-Z0-9_]*?)(__(gte|lte|gt|lt|ne))?$/', $key, $matches)) {
                continue;
            }

            $column = $matches[1];
            $operator = match ($matches[3] ?? '') {
                'gte' => '>=',
                'lte' => '<=',
                'gt' => '>',
                'lt' => '<',
                'ne' => '!=',
                default => '=',
            };
            $param = 'filter_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $key);

            $where[] = "{$column} {$operator} :{$param}";
            $params[$param] = $value;
        }
    }

    private function orderBy(): string
    {
        $sort = (string) ($_GET['sort'] ?? 'created_at');
        $order = strtolower((string) ($_GET['order'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';

        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $sort)) {
            $sort = 'created_at';
        }

        return "{$sort} {$order}";
    }

    private function insert(string $table, array $body): void
    {
        $columns = array_filter(array_keys($body), fn (string $key): bool => preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $key) === 1);
        $placeholders = array_map(fn (string $key): string => ":{$key}", $columns);
        $sql = "INSERT INTO {$table} (" . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';

        $stmt = Database::connection()->prepare($sql);
        foreach ($columns as $column) {
            $stmt->bindValue(":{$column}", $this->normalizeValue($body[$column]));
        }
        $stmt->execute();
    }

    private function normalizeValue(mixed $value): mixed
    {
        if (is_array($value) || is_object($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return $value;
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
