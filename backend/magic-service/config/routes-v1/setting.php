<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Kernel\Facade\GlobalConfigApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/settings', static function () {
    // 获取全局配置
    Router::get('/global', [GlobalConfigApi::class, 'getGlobalConfig']);
    Router::put('/global', [GlobalConfigApi::class, 'updateGlobalConfig'], ['middleware' => [RequestContextMiddleware::class]]);
});
