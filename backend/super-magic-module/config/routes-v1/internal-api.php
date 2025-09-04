<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\SandboxTokenAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi\FileApi;
use Hyperf\HttpServer\Router\Router;

// 沙箱内部API路由分组 - 专门给沙箱调用超级麦吉使用
Router::addGroup(
    '/open/internal-api',
    static function () {
        // 超级助理相关
        Router::addGroup('/super-agent', static function () {
            // 文件管理相关
            Router::addGroup('/file', static function () {
                // 创建文件版本
                Router::post('/versions', [FileApi::class, 'createFileVersion']);
            });
        });
    },
    ['middleware' => [SandboxTokenAuthMiddleware::class]]
);
