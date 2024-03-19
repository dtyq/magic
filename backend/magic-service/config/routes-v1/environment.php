<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Chat\Facade\MagicEnvironmentApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/environments', static function () {
    // 创建环境
    Router::post('', [MagicEnvironmentApi::class, 'createMagicEnvironment']);
    // 更新环境
    Router::put('', [MagicEnvironmentApi::class, 'updateMagicEnvironment']);
    // 批量获取环境
    Router::post('/queries', [MagicEnvironmentApi::class, 'getMagicEnvironments']);
}, ['middleware' => [RequestContextMiddleware::class]]);
