<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\MagicFS\Facade\MagicFSApi;
use Hyperf\HttpServer\Router\Router;

/*
 * MagicFS 文件系统 API 路由
 *
 * 这些 API 用于支持 AGFS magicfs 插件挂载 Magic 项目文件系统
 * 注意：当前未配置鉴权中间件，仅用于测试
 */
Router::addGroup(
    '/api/v1/open-api/magicfs',
    static function () {
        Router::addGroup('/files', static function () {
            // 列出目录内容
            Router::post('/queries', [MagicFSApi::class, 'listFiles']);

            // 批量获取文件版本号（需要在 /{id}/queries 之前定义，避免路由冲突）
            Router::post('/versions', [MagicFSApi::class, 'getFileVersions']);

            // 获取文件信息
            Router::post('/{id}/queries', [MagicFSApi::class, 'getFileInfo']);

            // 创建文件或目录
            Router::post('', [MagicFSApi::class, 'createFile']);

            // 更新文件元数据
            Router::put('/{id}', [MagicFSApi::class, 'updateFile']);

            // 删除文件或目录
            Router::delete('/{id}', [MagicFSApi::class, 'deleteFile']);

            // 获取文件树
            Router::post('/{id}/tree', [MagicFSApi::class, 'getFileTree']);

            // 获取单个文件版本号
            Router::get('/{id}/version', [MagicFSApi::class, 'getFileVersion']);
        });
    }
);
