<?php

declare(strict_types=1);

namespace SchoolXNow\Security;

use SchoolXNow\Core\Config;

final class TokenService
{
    public static function issue(array $claims): string
    {
        $header = self::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = self::base64UrlEncode(json_encode([
            ...$claims,
            'iat' => time(),
            'exp' => time() + (int) Config::get('JWT_TTL_SECONDS', '86400'),
        ]));
        $signature = self::sign("{$header}.{$payload}");

        return "{$header}.{$payload}.{$signature}";
    }

    public static function verify(?string $token): ?array
    {
        if (!$token) {
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;
        if (!hash_equals(self::sign("{$header}.{$payload}"), $signature)) {
            return null;
        }

        $claims = json_decode(self::base64UrlDecode($payload), true);
        if (!is_array($claims) || (($claims['exp'] ?? 0) < time())) {
            return null;
        }

        return $claims;
    }

    private static function sign(string $value): string
    {
        return self::base64UrlEncode(hash_hmac('sha256', $value, Config::required('JWT_SECRET'), true));
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/')) ?: '';
    }
}
