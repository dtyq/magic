<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\OptionalUserAuthMiddleware;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\Share\Facade\ShareApi;
use Hyperf\HttpServer\Router\Router;

// 需要登录的分享管理接口
Router::addGroup(
    '/api/v1/share',
    static function () {
        Router::addGroup('/resources', static function () {
            // 生成资源ID
            Router::post('/id', [ShareApi::class, 'generateResourceId']);
            // 创建资源分享（支持创建和更新）
            Router::post('/create', [ShareApi::class, 'createShare']);
            // 查找相同配置的分享
            Router::post('/find-similar', [ShareApi::class, 'findSimilarShare']);
            // 取消分享
            Router::post('/{id}/cancel', [ShareApi::class, 'cancelShareByResourceId']);
            // 批量取消分享
            Router::post('/batch-cancel', [ShareApi::class, 'batchCancelShareByResourceIds']);

            // 获取用户分享资源列表
            Router::post('/list', [ShareApi::class, 'getShareList']);
            // 通过分享code获取分享信息
            Router::get('/{shareCode}/setting', [ShareApi::class, 'getShareByCode']);

            // 复制资源文件
            Router::post('/copy', [ShareApi::class, 'copyResourceFiles']);
            // 获取分享访问日志
            Router::post('/access-logs', [ShareApi::class, 'getShareStatistics']);
            // 获取分享复制记录
            Router::post('/copy-logs', [ShareApi::class, 'getShareCopyLogs']);
            // 获取分享成员列表
            Router::get('/{resourceId}/members', [ShareApi::class, 'getShareMembers']);

            // 根据文件ID批量获取文件详情
            Router::post('/files/batch', [ShareApi::class, 'getFilesByIds']);
        });

        // 获取分享的项目树形结构（按工作区分组）
        Router::post('/projects/tree', [ShareApi::class, 'getSharedProjectsTree']);
    },
    ['middleware' => [UserAuthMiddleware::class]]
);

// 支持登录和非登录两种状态访问的接口
Router::addGroup(
    '/api/v1/share',
    static function () {
        Router::addGroup('/resources', static function () {
            // 查看是否需要密码
            Router::post('/{shareCode}/check', [ShareApi::class, 'checkShare']);
            // 获取分享详情
            Router::post('/{shareCode}/detail', [ShareApi::class, 'getShareDetail']);
            // 获取分享文件列表
            Router::post('/{shareCode}/files/queries', [ShareApi::class, 'getShareFiles']);
        });
    },
    ['middleware' => [OptionalUserAuthMiddleware::class]]
);
