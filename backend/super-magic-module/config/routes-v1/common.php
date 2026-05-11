<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\Common\Facade\CommonApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup(
    '/api/v1/common',
    static function () {
        Router::addGroup('/ids', static function () {
            // 批量生成雪花ID
            Router::post('/batch-generate', [CommonApi::class, 'batchGenerateId']);
        });
    },
    ['middleware' => [UserAuthMiddleware::class]]
);
