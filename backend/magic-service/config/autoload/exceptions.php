<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Core\Exception\Handler\AppExceptionHandler;
use App\Infrastructure\Core\Exception\Handler\BusinessExceptionHandler;
use App\Infrastructure\Core\Exception\Handler\InvalidArgumentExceptionHandler;
use App\Infrastructure\Core\Exception\Handler\OpenAIProxyExceptionHandler;
use Hyperf\HttpServer\Exception\Handler\HttpExceptionHandler;

return [
    'handler' => [
        'http' => [
            OpenAIProxyExceptionHandler::class,
            BusinessExceptionHandler::class,
            InvalidArgumentExceptionHandler::class,
            HttpExceptionHandler::class,
            AppExceptionHandler::class,
        ],
        // ws的异常只对 ON_HAND_SHAKE 有效.
        // ON_MESSAGE 不会触发异常处理分发
        'socket-io' => [
            BusinessExceptionHandler::class,
            InvalidArgumentExceptionHandler::class,
            HttpExceptionHandler::class,
            AppExceptionHandler::class,
        ],
    ],
];
