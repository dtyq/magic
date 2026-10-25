<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Admin\SuperMagic\Agent\AdminMagicClawRuntimeApi;
use App\Interfaces\Admin\SuperMagic\Agent\AdminSuperMagicAgentApi;
use App\Interfaces\Admin\SuperMagic\Agent\AdminSuperMagicCategoryApi;
use App\Interfaces\Admin\SuperMagic\Skill\AdminOfficialSkillApi;
use App\Interfaces\Admin\SuperMagic\Skill\AdminSkillApi;
use App\Interfaces\Admin\SuperMagic\Skill\AdminSkillCategoryApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v2/admin', static function () {
    Router::addGroup('/super-magic/agents', static function () {
        Router::addGroup('/categories', static function () {
            Router::post('/queries', [AdminSuperMagicCategoryApi::class, 'queries']);
            Router::post('', [AdminSuperMagicCategoryApi::class, 'create']);
            Router::get('/{id:\d+}', [AdminSuperMagicCategoryApi::class, 'show']);
            Router::put('/{id:\d+}', [AdminSuperMagicCategoryApi::class, 'update']);
            Router::delete('/{id:\d+}', [AdminSuperMagicCategoryApi::class, 'delete']);
        });

        Router::addGroup('/versions', static function () {
            Router::post('/queries', [AdminSuperMagicAgentApi::class, 'queryVersions']);
            Router::put('/{id}/review', [AdminSuperMagicAgentApi::class, 'reviewAgentVersion']);
        });

        Router::addGroup('/markets', static function () {
            Router::post('/queries', [AdminSuperMagicAgentApi::class, 'queryMarkets']);
            Router::post('/vector-index/reindex', [AdminSuperMagicAgentApi::class, 'reindexMarketVectors']);
            Router::put('/{id}', [AdminSuperMagicAgentApi::class, 'updateMarket']);
            Router::put('/{id}/category', [AdminSuperMagicAgentApi::class, 'updateMarketCategory']);
            Router::put('/{id}/sort-order', [AdminSuperMagicAgentApi::class, 'updateMarketSortOrder']);
        });

        Router::get('/{code}', [AdminSuperMagicAgentApi::class, 'getDetailByCode']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

Router::addGroup('/api/v1/admin', static function () {
    Router::addGroup('/super-magic/claws/runtime-reconciliation', static function () {
        Router::get('', [AdminMagicClawRuntimeApi::class, 'show']);
        Router::post('/retry', [AdminMagicClawRuntimeApi::class, 'retry']);
    });
    // Preserve the earlier retry URL while keeping its implementation in the owning module.
    Router::post('/function-permissions/magic_claw.access/runtime-reconciliation/retry', [AdminMagicClawRuntimeApi::class, 'retry']);

    // Admin 路由组
    Router::addGroup('/skills', static function () {
        Router::addGroup('/categories', static function () {
            Router::post('/queries', [AdminSkillCategoryApi::class, 'queries']);
            Router::post('', [AdminSkillCategoryApi::class, 'create']);
            Router::get('/{id:\d+}', [AdminSkillCategoryApi::class, 'show']);
            Router::put('/{id:\d+}', [AdminSkillCategoryApi::class, 'update']);
            Router::delete('/{id:\d+}', [AdminSkillCategoryApi::class, 'delete']);
        });

        Router::post('/versions/queries', [AdminSkillApi::class, 'queryVersions']);
        Router::post('/markets/queries', [AdminSkillApi::class, 'queryMarkets']);
        Router::post('/markets/vector-index/reindex', [AdminSkillApi::class, 'reindexMarketVectors']);
        Router::post('/markets/repair-skill-file-urls', [AdminSkillApi::class, 'repairSkillFileUrls']);
        Router::put('/markets/{id}', [AdminSkillApi::class, 'updateMarket']);
        Router::put('/markets/{id}/category', [AdminSkillApi::class, 'updateMarketCategory']);
        Router::put('/markets/{id}/sort-order', [AdminSkillApi::class, 'updateMarketSortOrder']);
        Router::put('/markets/{id}/offline', [AdminSkillApi::class, 'offlineMarket']);
        Router::put('/versions/{id}/review', [AdminSkillApi::class, 'reviewSkillVersion']);
    });

    Router::addGroup('/official-skills/import', static function () {
        Router::post('/parse/file', [AdminOfficialSkillApi::class, 'parseImport']);
        Router::post('', [AdminOfficialSkillApi::class, 'import']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
