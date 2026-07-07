<?php

declare(strict_types=1);

namespace SchoolXNow\Api;

use SchoolXNow\Core\Config;
use SchoolXNow\Core\Response;
use SchoolXNow\Security\Auth;

final class UploadController
{
    private const ALLOWED_BUCKETS = ['avatars', 'student-photos', 'documents'];
    private const ALLOWED_MIME_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];

    public function store(string $bucket): void
    {
        Auth::user();

        if (!in_array($bucket, self::ALLOWED_BUCKETS, true)) {
            Response::json(['error' => ['message' => 'Upload bucket is not allowed']], 404);
        }

        if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
            Response::json(['error' => ['message' => 'File is required']], 422);
        }

        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::json(['error' => ['message' => 'File upload failed']], 400);
        }

        $maxBytes = (int) Config::get('UPLOAD_MAX_BYTES', '5242880');
        if ((int) $file['size'] > $maxBytes) {
            Response::json(['error' => ['message' => 'File is too large']], 422);
        }

        $tmpName = (string) $file['tmp_name'];
        $mimeType = mime_content_type($tmpName) ?: '';
        if (!array_key_exists($mimeType, self::ALLOWED_MIME_TYPES)) {
            Response::json(['error' => ['message' => 'File type is not allowed']], 422);
        }

        if ($bucket !== 'documents' && !str_starts_with($mimeType, 'image/')) {
            Response::json(['error' => ['message' => 'Only images are allowed in this bucket']], 422);
        }

        $extension = self::ALLOWED_MIME_TYPES[$mimeType];
        $filename = self::safeName(pathinfo((string) $file['name'], PATHINFO_FILENAME));
        $storedName = date('YmdHis') . '-' . bin2hex(random_bytes(8)) . '-' . $filename . '.' . $extension;
        $storageRoot = Config::get('UPLOAD_STORAGE_DIR', dirname(__DIR__, 2) . '/public/uploads');
        $targetDir = rtrim($storageRoot ?? '', "/\\") . '/' . $bucket;

        if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
            Response::json(['error' => ['message' => 'Upload directory could not be created']], 500);
        }

        $targetPath = $targetDir . '/' . $storedName;
        if (!move_uploaded_file($tmpName, $targetPath)) {
            Response::json(['error' => ['message' => 'Unable to store uploaded file']], 500);
        }

        $url = self::baseUrl() . '/uploads/' . rawurlencode($bucket) . '/' . rawurlencode($storedName);
        Response::json([
            'data' => [
                'bucket' => $bucket,
                'filename' => $storedName,
                'url' => $url,
                'mime_type' => $mimeType,
                'size' => (int) $file['size'],
            ],
        ], 201);
    }

    private static function safeName(string $name): string
    {
        $clean = strtolower(preg_replace('/[^a-zA-Z0-9_-]+/', '-', $name) ?? 'file');
        $clean = trim($clean, '-');
        return $clean === '' ? 'file' : substr($clean, 0, 60);
    }

    private static function baseUrl(): string
    {
        $configured = Config::get('PUBLIC_API_URL');
        if ($configured !== null && $configured !== '') {
            return rtrim($configured, '/');
        }

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
        return $scheme . '://' . $host . ($base === '' ? '' : $base);
    }
}
