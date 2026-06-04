<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Ops\Facade\SocketIORedisOpsApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/ops', static function () {
    Router::post('/socketio/redis/cleanup', [SocketIORedisOpsApi::class, 'cleanup']);
}, ['middleware' => [RequestContextMiddleware::class]]);
