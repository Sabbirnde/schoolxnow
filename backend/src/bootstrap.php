<?php

declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    $prefix = 'SchoolXNow\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';

    if (is_file($file)) {
        require_once $file;
    }
});

SchoolXNow\Core\Env::load(__DIR__ . '/../.env');
SchoolXNow\Core\Monitoring::initialize();

set_exception_handler(function (Throwable $error): void {
    SchoolXNow\Core\Monitoring::logError($error);
    SchoolXNow\Core\Response::json([
        'error' => [
            'message' => 'Internal server error',
            'detail' => getenv('APP_DEBUG') === 'true' ? $error->getMessage() : null,
        ],
    ], 500);
});

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    SchoolXNow\Core\Response::noContent();
}
