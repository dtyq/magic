<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Environment;

class EnvironmentUtil
{
    public const string ENV_LOCAL = 'local';

    public const string ENV_LOCAL_DEV = 'local-dev';

    // 是否本地环境
    public static function isLocal(): bool
    {
        $env = self::getEnv();
        return str_contains($env, 'local') || str_contains($env, 'dev');
    }

    public static function isTest(): bool
    {
        return str_contains(self::getEnv(), 'test');
    }

    public static function isPre(): bool
    {
        return str_contains(self::getEnv(), 'pre');
    }

    public static function isProd(): bool
    {
        return str_contains(self::getEnv(), 'prod');
    }

    public static function getEnv(): string
    {
        return env('APP_ENV', '');
    }
}
