<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin\AdminSuperMagicAgentApi;
use Dtyq\SuperMagic\Interfaces\Skill\Facade\Admin\AdminSkillApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v2/admin', static function () {
    Router::addGroup('/super-magic/agents', static function () {
        Router::get('/{code}', [AdminSuperMagicAgentApi::class, 'getDetailByCode']);
        Router::put('/versions/{id}/review', [AdminSuperMagicAgentApi::class, 'reviewAgentVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

Router::addGroup('/api/v1/admin', static function () {
    // Admin 路由组
    Router::addGroup('/skills', static function () {
        Router::get('/versions', [AdminSkillApi::class, 'queryVersions']);
        Router::put('/versions/{id}/review', [AdminSkillApi::class, 'reviewSkillVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
