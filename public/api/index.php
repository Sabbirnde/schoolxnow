<?php

declare(strict_types=1);

function schoolxnow_setenv_once(string $key, string $value): void
{
    if (getenv($key) !== false) {
        return;
    }

    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

$apiUploadDir = __DIR__ . '/uploads';
schoolxnow_setenv_once('UPLOAD_STORAGE_DIR', $apiUploadDir);

$configuredBackendIndex = getenv('SCHOOLXNOW_BACKEND_INDEX');
$candidates = array_filter([
    is_string($configuredBackendIndex) && $configuredBackendIndex !== '' ? $configuredBackendIndex : null,
    dirname(__DIR__, 2) . '/backend/public/index.php',
    dirname(__DIR__) . '/backend/public/index.php',
]);

foreach ($candidates as $candidate) {
    if (is_file($candidate)) {
        require $candidate;
        return;
    }
}

http_response_code(500);
header('Content-Type: application/json');
echo json_encode([
    'error' => [
        'message' => 'PHP backend was not found. Set SCHOOLXNOW_BACKEND_INDEX or upload the backend folder beside public_html.',
    ],
]);
