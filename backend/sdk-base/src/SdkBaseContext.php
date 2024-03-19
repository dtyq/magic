<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase;

use RuntimeException;

class SdkBaseContext
{
    private static array $containers = [];

    public static function get(string $key): SdkBase
    {
        $container = self::$containers[$key] ?? null;
        if (! $container instanceof SdkBase) {
            throw new RuntimeException("{$key} is not registered");
        }
        return $container;
    }

    public static function register(string $key, SdkBase $container): void
    {
        if (isset(self::$containers[$key])) {
            throw new RuntimeException("{$key} is already registered");
        }
        self::$containers[$key] = $container;
    }

    public static function has(string $key): bool
    {
        return isset(self::$containers[$key]);
    }
}
