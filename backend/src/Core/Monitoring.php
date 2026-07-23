<?php

declare(strict_types=1);

namespace SchoolXNow\Core;

use PDOException;
use Throwable;

final class Monitoring
{
    private static string $requestId = '';
    private static string $userRole = 'anonymous';

    public static function initialize(): void
    {
        $supplied = (string) ($_SERVER['HTTP_X_REQUEST_ID'] ?? '');
        self::$requestId = preg_match('/^[a-zA-Z0-9._-]{8,128}$/', $supplied)
            ? $supplied
            : bin2hex(random_bytes(16));
        header('X-Request-ID: ' . self::$requestId);
    }

    public static function requestId(): string
    {
        return self::$requestId;
    }

    public static function setUserRole(?string $role): void
    {
        if ($role !== null && $role !== '') {
            self::$userRole = $role;
        }
    }

    public static function logError(Throwable $error, string $event = 'api_error'): void
    {
        error_log((string) json_encode([
            'event' => $event,
            'request_id' => self::$requestId,
            'endpoint' => parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH),
            'method' => (string) ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN'),
            'user_role' => self::$userRole,
            'error' => [
                'name' => $error::class,
                'code' => $error instanceof PDOException ? (string) $error->getCode() : null,
            ],
            'timestamp' => gmdate('c'),
        ], JSON_UNESCAPED_SLASHES));
    }
}
