<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Asr\Facade\AsrTokenApi;
use Hyperf\HttpServer\Router\Router;

// ASR 语音识别服务路由 - RESTful 风格
Router::addGroup('/api/v1/asr', function () {
    // JWT Token 资源管理
    Router::get('/tokens', [AsrTokenApi::class, 'show']);        // 获取当前用户的JWT Token
    Router::delete('/tokens', [AsrTokenApi::class, 'destroy']);  // 清除当前用户的JWT Token缓存
}, ['middleware' => [RequestContextMiddleware::class]]);
