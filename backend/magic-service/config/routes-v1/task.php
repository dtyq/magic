<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Chat\Facade\MagicUserTaskApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/user', static function () {
    // 获取任务列表
    Router::get('/task', [MagicUserTaskApi::class, 'listTask']);
    // 创建任务
    Router::post('/task', [MagicUserTaskApi::class, 'createTask']);
    // 获取单个任务
    Router::get('/task/{id}', [MagicUserTaskApi::class, 'getTask']);
    // 更新任务
    Router::put('/task/{id}', [MagicUserTaskApi::class, 'updateTask']);
    // 删除任务
    Router::delete('/task/{id}', [MagicUserTaskApi::class, 'deleteTask']);
}, ['middleware' => [RequestContextMiddleware::class]]);
