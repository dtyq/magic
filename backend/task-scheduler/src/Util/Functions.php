<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Util;

use function Hyperf\Config\config;

class Functions
{
    public static function getEnv(): string
    {
        $appEnv = '';
        if (! config('task_scheduler.environment_enabled', true)) {
            return '';
        }
        if (function_exists('app_env')) {
            $appEnv = app_env();
        }
        if (empty($appEnv)) {
            return '';
        }
        return $appEnv;
    }
}
