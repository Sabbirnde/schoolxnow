<?php

declare(strict_types=1);

namespace SchoolXNow\Core;

final class Config
{
    public static function get(string $key, ?string $default = null): ?string
    {
        $value = getenv($key);
        return $value === false ? $default : $value;
    }

    public static function required(string $key): string
    {
        $value = self::get($key);
        if ($value === null || $value === '') {
            Response::json([
                'error' => ['message' => "Missing environment variable: {$key}"],
            ], 500);
        }

        return $value;
    }
}
