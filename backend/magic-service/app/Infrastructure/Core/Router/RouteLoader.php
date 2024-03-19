<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Router;

class RouteLoader
{
    public static function loadDir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        // 获取目录下的所有*php
        $files = glob($dir . '/*.php');
        foreach ($files as $file) {
            self::loadPath($file);
        }
    }

    public static function loadPath(string $path): void
    {
        if (file_exists($path)) {
            require_once $path;
        }
    }
}
