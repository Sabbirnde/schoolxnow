<?php

declare(strict_types=1);

namespace SchoolXNow\Security;

use SchoolXNow\Core\ApiContract;
use SchoolXNow\Core\Database;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;
use SchoolXNow\Core\Monitoring;

final class Auth
{
    public static function user(): array
    {
        $claims = TokenService::verify(Request::bearerToken());
        if ($claims === null || empty($claims['sub'])) {
            Response::json(['error' => ['message' => 'Unauthenticated']], 401);
        }

        $stmt = Database::connection()->prepare(
            'SELECT u.id,
                    u.email,
                    p.school_id,
                    COALESCE(r.role, p.role) AS role,
                    p.full_name,
                    p.full_name_bangla,
                    p.phone,
                    p.avatar_url,
                    p.address,
                    p.address_bangla,
                    p.approval_status,
                    IF(u.is_active = 1 AND p.is_active = 1, 1, 0) AS is_active
             FROM users u
             JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN user_roles r ON r.user_id = u.id
             WHERE u.id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $claims['sub']]);
        $user = $stmt->fetch();

        if (!$user || (int) $user['is_active'] !== 1) {
            Response::json(['error' => ['message' => 'Account is inactive or missing']], 403);
        }

        Monitoring::setUserRole((string) $user['role']);
        return $user;
    }

    public static function canAccessTable(array $user, string $table, string $operation): bool
    {
        return ApiContract::allows((string) $user['role'], $table, $operation);
    }
}
