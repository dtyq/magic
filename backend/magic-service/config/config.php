<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Contract\StdoutLoggerInterface;
use Psr\Log\LogLevel;

use function Hyperf\Support\env;

/*
 * app_env: dev(开发环境), test(测试环境), pre(预发布环境), production(生产环境)
 */
return [
    'app_name' => env('APP_NAME', 'skeleton'),
    'app_env' => env('APP_ENV', 'dev'),
    'app_host' => env('APP_HOST', ''),
    'app_code' => env('APP_CODE', 'magic'),
    'scan_cacheable' => env('SCAN_CACHEABLE', false),
    'office_organization' => env('OFFICE_ORGANIZATION', ''),
    StdoutLoggerInterface::class => [
        'log_level' => [
            LogLevel::ALERT,
            LogLevel::CRITICAL,
            LogLevel::EMERGENCY,
            LogLevel::ERROR,
            LogLevel::INFO,
            LogLevel::NOTICE,
            LogLevel::WARNING,
        ],
    ],
];
