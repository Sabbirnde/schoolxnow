<?php

declare(strict_types=1);

namespace SchoolXNow\Security;

use SchoolXNow\Core\Database;
use SchoolXNow\Core\Request;
use SchoolXNow\Core\Response;

final class RateLimiter
{
    public static function enforce(
        string $action,
        string $identity,
        int $limit,
        int $windowSeconds
    ): void {
        $limit = max(1, $limit);
        $windowSeconds = max(1, $windowSeconds);
        $keyHash = hash('sha256', $action . '|' . Request::ip() . '|' . strtolower(trim($identity)));
        $pdo = Database::connection();

        $sql = "INSERT INTO api_rate_limits
                    (key_hash, action, attempts, window_started_at, expires_at)
                VALUES
                    (:key_hash, :action, 1, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL {$windowSeconds} SECOND))
                ON DUPLICATE KEY UPDATE
                    action = VALUES(action),
                    attempts = IF(expires_at <= UTC_TIMESTAMP(), 1, attempts + 1),
                    window_started_at = IF(expires_at <= UTC_TIMESTAMP(), UTC_TIMESTAMP(), window_started_at),
                    expires_at = IF(
                        expires_at <= UTC_TIMESTAMP(),
                        DATE_ADD(UTC_TIMESTAMP(), INTERVAL {$windowSeconds} SECOND),
                        expires_at
                    )";
        $pdo->prepare($sql)->execute(['key_hash' => $keyHash, 'action' => $action]);

        $stmt = $pdo->prepare(
            'SELECT attempts,
                    GREATEST(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at), 1) AS retry_after
             FROM api_rate_limits
             WHERE key_hash = :key_hash
             LIMIT 1'
        );
        $stmt->execute(['key_hash' => $keyHash]);
        $state = $stmt->fetch() ?: ['attempts' => 0, 'retry_after' => $windowSeconds];

        header('X-RateLimit-Limit: ' . $limit);
        header('X-RateLimit-Remaining: ' . max(0, $limit - (int) $state['attempts']));

        if ((int) $state['attempts'] > $limit) {
            header('Retry-After: ' . max(1, (int) $state['retry_after']));
            Response::json(['error' => ['message' => 'Too many requests. Please wait and try again.']], 429);
        }
    }
}
