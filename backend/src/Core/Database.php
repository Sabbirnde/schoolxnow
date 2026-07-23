<?php

declare(strict_types=1);

namespace SchoolXNow\Core;

use PDO;
use Throwable;

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = Config::required('DB_HOST');
        $port = Config::get('DB_PORT', '3306');
        $name = Config::required('DB_DATABASE');
        $user = Config::required('DB_USERNAME');
        $pass = Config::required('DB_PASSWORD');
        $charset = Config::get('DB_CHARSET', 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        if (Config::get('DB_SSL', 'false') === 'true') {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] =
                Config::get('DB_SSL_REJECT_UNAUTHORIZED', 'true') !== 'false';

            $caPath = Config::get('DB_SSL_CA');
            if ($caPath !== null && $caPath !== '') {
                $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
            }
        }

        try {
            self::$pdo = new PDO($dsn, $user, $pass, $options);
        } catch (Throwable $error) {
            Monitoring::logError($error, 'mysql_connection_error');
            throw $error;
        }

        return self::$pdo;
    }
}
