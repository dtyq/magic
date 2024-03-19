<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Provider\Facade\Open\ServiceProviderOpenApi;
use Hyperf\HttpServer\Router\Router;

// 不校验管理员权限的路由组
Router::addGroup('/api/v1', static function () {
    Router::addGroup('/service-providers', static function () {
        // 获取可用的模型列表（不校验管理员权限）
        Router::post('/available-models', [ServiceProviderOpenApi::class, 'getAvailableModels']);
    });

    Router::addGroup('/service-provider/models', static function () {
        Router::post('/queries', [ServiceProviderOpenApi::class, 'queries']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/llm-model', static function () {
        // 根据名称匹配模型
        Router::get('/match', [ServiceProviderOpenApi::class, 'matchModelByName']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
