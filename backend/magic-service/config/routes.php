<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Core\Router\RouteLoader;
use Hyperf\HttpServer\Router\Router;

// 基础路由
Router::get('/', function () {
    return 'hello, magic-service!';
});
Router::get('/favicon.ico', function () {
    return '';
});
Router::addRoute(
    ['GET', 'POST', 'HEAD', 'OPTIONS'],
    '/heartbeat',
    function () {
        return ['status' => 'UP'];
    }
);

// 加载 Mock 路由（用于测试）
require BASE_PATH . '/config/routes-mock.php';

// 加载 v1 路由
RouteLoader::loadDir(BASE_PATH . '/config/routes-v1');
