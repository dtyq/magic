<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Bootstrap\Facade\BootstrapApi;
use Hyperf\HttpServer\Router\Router;

// 项目启动后数据初始化路由（RESTful：GET 查状态，POST 执行）
Router::addGroup('/api/v1/bootstrap', static function () {
    Router::get('/status', [BootstrapApi::class, 'checkStatus']);
    Router::post('', [BootstrapApi::class, 'execute']);
    Router::post('/llm/connectivity-test', [BootstrapApi::class, 'llmConnectivityTest']);
});
