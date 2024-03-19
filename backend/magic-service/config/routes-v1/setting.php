<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Kernel\Facade\GlobalConfigApi;
// Platform settings routes moved to admin.php
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/settings', static function () {
    // 获取全局配置
    Router::post('/global/data', [GlobalConfigApi::class, 'getGlobalDataQueries'], ['middleware' => [RequestContextMiddleware::class]]);
    Router::get('/global', [GlobalConfigApi::class, 'getGlobalConfig']);
    Router::get('/all', [GlobalConfigApi::class, 'getAllGlobalConfig']);
    Router::get('/menu-modules', [GlobalConfigApi::class, 'getMenuModules'], ['middleware' => [RequestContextMiddleware::class]]);
    Router::put('/global', [GlobalConfigApi::class, 'updateGlobalConfig'], ['middleware' => [RequestContextMiddleware::class]]);
});
