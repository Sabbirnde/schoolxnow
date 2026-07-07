<?php

declare(strict_types=1);

namespace SchoolXNow\Core;

final class Response
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: ' . Config::get('CORS_ORIGIN', '*'));
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function noContent(): never
    {
        http_response_code(204);
        header('Access-Control-Allow-Origin: ' . Config::get('CORS_ORIGIN', '*'));
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        exit;
    }
}
