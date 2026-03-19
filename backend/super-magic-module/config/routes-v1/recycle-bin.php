<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\RecycleBin\RecycleBinApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup(
    '/api/v1/recycle-bin',
    static function () {
        // 获取回收站列表
        Router::get('/list', [RecycleBinApi::class, 'getRecycleBinList']);

        // 检查父级是否存在
        Router::post('/check', [RecycleBinApi::class, 'checkParent']);

        // 恢复资源
        Router::post('/restore', [RecycleBinApi::class, 'restore']);

        // 彻底删除（永久删除）
        Router::post('/permanent-delete', [RecycleBinApi::class, 'permanentDelete']);

        // 移动回收站中的项目（移动+恢复）
        Router::post('/move-project', [RecycleBinApi::class, 'moveProject']);

        // 批量移动回收站中的项目（批量移动+恢复）
        Router::post('/batch-move-project', [RecycleBinApi::class, 'batchMoveProject']);

        // 移动回收站中的话题（移动+恢复）
        Router::post('/move-topic', [RecycleBinApi::class, 'moveTopic']);

        // 批量移动回收站中的话题（批量移动+恢复）
        Router::post('/batch-move-topic', [RecycleBinApi::class, 'batchMoveTopic']);
    },
    ['middleware' => [UserAuthMiddleware::class]]
);
