<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\SandboxUserAuthMiddleware;
use App\Interfaces\SuperMagic\File\MagicFS\Facade\MagicFSApi;
use Hyperf\HttpServer\Router\Router;

/*
 * MagicFS 文件系统 API 路由
 *
 * 这些 API 用于支持 AGFS magicfs 插件挂载 Magic 项目文件系统
 */
Router::addGroup(
    '/api/v1/open-api/magicfs',
    static function () {
        // 根据项目 ID 获取项目根目录 file_id（agfs-server 动态挂载 referenced-project 时调用）
        Router::get('/projects/{projectId}/root-file-id', [MagicFSApi::class, 'getProjectRootFileId']);

        // 批量拉取多个文件树的变更（推送不可用时的合并轮询入口）。
        // 必须定义在 /files/{id}/... 之前，避免将来出现同前缀动态段时被抢占。
        Router::post('/changes/batch', [MagicFSApi::class, 'getFileTreeChangesBatch']);

        Router::addGroup('/files', static function () {
            // 列出目录内容
            Router::post('/queries', [MagicFSApi::class, 'listFiles']);

            // 批量获取文件版本号（需要在 /{id}/queries 之前定义，避免路由冲突）
            Router::post('/versions', [MagicFSApi::class, 'getFileVersions']);

            // 写权限预检（无副作用）。与 updateFile 同套鉴权（EDITOR），
            // 供 magicfs 客户端在写 S3 / 本地缓存之前确认当前用户具备写权限，
            // 避免先写 S3 再被元数据服务拒绝导致数据不一致。
            Router::post('/{id}/check-access', [MagicFSApi::class, 'checkFileAccess']);

            // 获取文件信息
            Router::post('/{id}/queries', [MagicFSApi::class, 'getFileInfo']);

            // 按直接子项分页读取目录。挂载端必须使用此接口，禁止通过
            // tree 接口把整个项目元数据加载进单个请求。
            Router::post('/{id}/children', [MagicFSApi::class, 'listChildrenPage']);

            // 创建文件或目录
            Router::post('', [MagicFSApi::class, 'createFile']);

            // Rename / move. Separate from updateFile because "who survives when
            // the destination is occupied" is an identity decision a partial
            // update cannot express (see RenameFileRequestDTO).
            Router::post('/{id}/rename', [MagicFSApi::class, 'renameFile']);

            // 更新文件元数据
            Router::put('/{id}', [MagicFSApi::class, 'updateFile']);

            // 删除文件或目录
            Router::delete('/{id}', [MagicFSApi::class, 'deleteFile']);

            // Legacy/export tree API. It is strictly bounded by depth,
            // max_nodes and max_bytes; mount/FUSE code must use children
            // pages plus the change feed instead.
            Router::post('/{id}/tree', [MagicFSApi::class, 'getFileTree']);

            // 获取单个文件版本号
            Router::get('/{id}/version', [MagicFSApi::class, 'getFileVersion']);

            // 按持久化游标读取精准变更；挂载同步使用该接口，不再因根
            // 版本变化而重新下载整棵树。
            Router::get('/{id}/changes', [MagicFSApi::class, 'getFileTreeChanges']);
        });
    },
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);
