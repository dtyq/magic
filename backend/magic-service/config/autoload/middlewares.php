<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\CorsMiddleware;
use App\Infrastructure\Util\Middleware\LocaleMiddleware;
use App\Infrastructure\Util\Middleware\RequestIdMiddleware;
use App\Infrastructure\Util\Middleware\ResponseMiddleware;

return [
    'http' => [
        LocaleMiddleware::class,
        RequestIdMiddleware::class,
        CorsMiddleware::class,
        ResponseMiddleware::class,
    ],
    'socket-io' => [
    ],
];
