<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Mode\Facade\AdminModeApi;
use App\Interfaces\Mode\Facade\AdminModeGroupApi;
use App\Interfaces\Mode\Facade\ModeApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/official/admin', static function () {
        // 模式管理
        Router::addGroup('/modes', static function () {
            // 获取模式列表
            Router::get('', [AdminModeApi::class, 'getModes']);
            // 获取默认模式
            Router::get('/default', [AdminModeApi::class, 'getDefaultMode']);
            // 创建模式
            Router::post('', [AdminModeApi::class, 'createMode']);
            // 获取模式详情
            Router::get('/{id}', [AdminModeApi::class, 'getMode']);
            // 更新模式
            Router::put('/{id}', [AdminModeApi::class, 'updateMode']);
            // 更新模式状态
            Router::put('/{id}/status', [AdminModeApi::class, 'updateModeStatus']);
            // 保存模式配置
            Router::put('/{id}/config', [AdminModeApi::class, 'saveModeConfig']);
        });

        // 模式分组管理
        Router::addGroup('/mode-groups', static function () {
            // 根据模式ID获取分组列表
            Router::get('/mode/{modeId}', [AdminModeGroupApi::class, 'getGroupsByModeId']);
            // 获取分组详情
            Router::get('/{groupId}', [AdminModeGroupApi::class, 'getGroupDetail']);
            // 创建分组
            Router::post('', [AdminModeGroupApi::class, 'createGroup']);
            // 更新分组
            Router::put('/{groupId}', [AdminModeGroupApi::class, 'updateGroup']);
            // 删除分组
            Router::delete('/{groupId}', [AdminModeGroupApi::class, 'deleteGroup']);
        });
    });
    Router::addGroup('/modes', static function () {
        Router::get('', [ModeApi::class, 'getModes']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
