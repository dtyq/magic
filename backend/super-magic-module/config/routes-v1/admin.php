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
        Router::post('/versions/queries', [AdminSuperMagicAgentApi::class, 'queryVersions']);
        Router::post('/markets/queries', [AdminSuperMagicAgentApi::class, 'queryMarkets']);
        Router::put('/markets/{id}', [AdminSuperMagicAgentApi::class, 'updateMarket']);
        Router::put('/markets/{id}/sort-order', [AdminSuperMagicAgentApi::class, 'updateMarketSortOrder']);
        Router::get('/{code}', [AdminSuperMagicAgentApi::class, 'getDetailByCode']);
        Router::put('/versions/{id}/review', [AdminSuperMagicAgentApi::class, 'reviewAgentVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

Router::addGroup('/api/v1/admin', static function () {
    // Admin 路由组
    Router::addGroup('/skills', static function () {
        Router::post('/versions/queries', [AdminSkillApi::class, 'queryVersions']);
        Router::post('/markets/queries', [AdminSkillApi::class, 'queryMarkets']);
        Router::put('/markets/{id}', [AdminSkillApi::class, 'updateMarket']);
        Router::put('/markets/{id}/sort-order', [AdminSkillApi::class, 'updateMarketSortOrder']);
        Router::put('/markets/{id}/offline', [AdminSkillApi::class, 'offlineMarket']);
        Router::put('/versions/{id}/review', [AdminSkillApi::class, 'reviewSkillVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
