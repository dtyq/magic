<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\RequestContextMiddlewareV2;
use Dtyq\SuperMagic\Interfaces\Share\Facade\ShareApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup(
    '/api/v1/share',
    static function () {
        // 分享管理
        Router::addGroup('/resources', static function () {
            // 创建资源分享
            Router::post('/create', [ShareApi::class, 'createShare']);
            // 更新分享设置
            Router::post('/{id}/update', [ShareApi::class, 'updateShare']);
            // 取消分享
            Router::post('/{id}/cancel', [ShareApi::class, 'cancelShareByResourceId']);

            // 获取用户分享资源列表
            Router::post('/list', [ShareApi::class, 'getShareList']);
            // 通过分享code获取分享信息
            Router::get('/{shareCode}/setting', [ShareApi::class, 'getShareByCode']);
        });

        // 访问分享内容
        Router::addGroup('/access', static function () {
            // 访问分享链接
            Router::post('/{shareCode}', [ShareApi::class, 'accessShare']);
        });
    },
    ['middleware' => [RequestContextMiddlewareV2::class]]
);

Router::addGroup('/api/v1/share', static function () {
    // 查看是否需要密码
    Router::post('/resources/{shareCode}/check', [ShareApi::class, 'checkShare']);
    // 获取分享详情
    Router::post('/resources/{shareCode}/detail', [ShareApi::class, 'getShareDetail']);
});
