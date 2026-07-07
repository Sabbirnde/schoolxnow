<?php

declare(strict_types=1);

namespace SchoolXNow\Core;

final class Router
{
    /** @var array<int, array{method: string, pattern: string, handler: mixed}> */
    private array $routes = [];

    public function get(string $pattern, mixed $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, mixed $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function patch(string $pattern, mixed $handler): void
    {
        $this->add('PATCH', $pattern, $handler);
    }

    public function delete(string $pattern, mixed $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    private function add(string $method, string $pattern, mixed $handler): void
    {
        $this->routes[] = compact('method', 'pattern', 'handler');
    }

    public function dispatch(string $method, string $uri): void
    {
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
        if ($base !== '' && str_starts_with($path, $base)) {
            $path = substr($path, strlen($base)) ?: '/';
        }

        $apiBase = rtrim(Config::get('API_BASE_PATH', '/api') ?? '', '/');
        if ($apiBase !== '' && ($path === $apiBase || str_starts_with($path, $apiBase . '/'))) {
            $path = substr($path, strlen($apiBase)) ?: '/';
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }

            $params = $this->match($route['pattern'], $path);
            if ($params === null) {
                continue;
            }

            $handler = $route['handler'];
            if (is_array($handler) && is_string($handler[0])) {
                $instance = new $handler[0]();
                $methodName = $handler[1];
                $instance->$methodName(...array_values($params));
                return;
            }

            $handler(...array_values($params));
            return;
        }

        Response::json(['error' => ['message' => 'Route not found']], 404);
    }

    private function match(string $pattern, string $path): ?array
    {
        $names = [];
        $regex = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', function (array $matches) use (&$names): string {
            $names[] = $matches[1];
            return '([^/]+)';
        }, $pattern);

        if (!preg_match('#^' . $regex . '$#', $path, $matches)) {
            return null;
        }

        array_shift($matches);
        return array_combine($names, array_map('urldecode', $matches)) ?: [];
    }
}
