<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\SandboxUserAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\MagicClawApi;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Old\SuperMagicAgentOldApi;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\SuperMagicAgentApi;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\SuperMagicAgentMarketApi;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\SuperMagicAgentPlaybookApi;
use Hyperf\HttpServer\Router\Router;

// Legacy version. This group can be removed after the new version is fully rolled out.
Router::addGroup('/api/v1/super-magic', static function () {
    Router::addGroup('/agents', static function () {
        Router::post('', [SuperMagicAgentOldApi::class, 'save']);
        Router::post('/queries', [SuperMagicAgentOldApi::class, 'queries']);
        Router::post('/ai-optimize', [SuperMagicAgentOldApi::class, 'aiOptimize']);
        Router::post('/order', [SuperMagicAgentOldApi::class, 'saveOrder']);
        // Static routes must be declared before variable routes, otherwise /{code} will shadow them.
        Router::get('/builtin-tools', [SuperMagicAgentOldApi::class, 'tools']);
        Router::get('/builtin-skills', [SuperMagicAgentOldApi::class, 'skills']);
        Router::get('/{code}', [SuperMagicAgentOldApi::class, 'show']);
        Router::delete('/{code}', [SuperMagicAgentApi::class, 'destroy']);
        Router::put('/{code}/enable', [SuperMagicAgentOldApi::class, 'enable']);
        Router::put('/{code}/disable', [SuperMagicAgentOldApi::class, 'disable']);
    });
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v2/super-magic', static function () {
    Router::addGroup('/agents', static function () {
        Router::get('/featured/sort-list', [SuperMagicAgentApi::class, 'sortListQueries']);
        Router::post('/queries', [SuperMagicAgentApi::class, 'queries']);
        Router::post('/external/queries', [SuperMagicAgentApi::class, 'externalQueries']);
        Router::post('/import', [SuperMagicAgentApi::class, 'import']);
        Router::post('', [SuperMagicAgentApi::class, 'create']);
        Router::put('/{code}', [SuperMagicAgentApi::class, 'update']);
        Router::put('/{code}/updated-at', [SuperMagicAgentApi::class, 'touchUpdatedAt']);
        Router::get('/mention-skills', [SuperMagicAgentApi::class, 'getMentionSkills']);
        Router::get('/{code}/versions', [SuperMagicAgentApi::class, 'getVersionList']);
        Router::get('/{code}', [SuperMagicAgentApi::class, 'show']);
        Router::delete('/{code}', [SuperMagicAgentApi::class, 'destroy']);
        Router::get('/{code}/publish/prefill', [SuperMagicAgentApi::class, 'getPublishPrefill']);
        Router::post('/{code}/publish', [SuperMagicAgentApi::class, 'publishAgent']);
        //        Router::post('/{code}/export', [SuperMagicAgentApi::class, 'export']);
        //        Router::put('/{code}/project', [SuperMagicAgentApi::class, 'bindProject']);

        // playbooks
        Router::post('/{code}/playbooks', [SuperMagicAgentPlaybookApi::class, 'createPlaybook']);
        Router::put('/{code}/playbooks/reorder', [SuperMagicAgentPlaybookApi::class, 'reorderPlaybooks']);
        Router::put('/{code}/playbooks/{playbookId}/enabled', [SuperMagicAgentPlaybookApi::class, 'togglePlaybookEnabled']);
        Router::put('/{code}/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'updatePlaybook']);
        Router::get('/{code}/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'getPlaybook']);
        Router::delete('/{code}/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'deletePlaybook']);
        Router::get('/{code}/playbooks', [SuperMagicAgentPlaybookApi::class, 'getAgentPlaybooks']);

        // skills
        // Router::put('/{code}/skills', [SuperMagicAgentApi::class, 'updateAgentSkills']);
        Router::post('/{code}/skills', [SuperMagicAgentApi::class, 'addAgentSkills']);
        Router::delete('/{code}/skills', [SuperMagicAgentApi::class, 'removeAgentSkills']);
    });

    Router::addGroup('/agent-market', static function () {
        Router::post('/queries', [SuperMagicAgentMarketApi::class, 'queries']);
        Router::get('/categories', [SuperMagicAgentMarketApi::class, 'getCategories']);
        Router::get('/{code}', [SuperMagicAgentMarketApi::class, 'show']);
        Router::post('/{code}/hire', [SuperMagicAgentApi::class, 'hireAgent']);
    });
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v1/magic-claw', static function () {
    Router::post('/queries', [MagicClawApi::class, 'queries']); // static route must be before /{code}
    Router::post('', [MagicClawApi::class, 'create']);
    // /sandbox 必须在 /{code} 之前注册，否则 DELETE /sandbox 会被 /{code} 遮蔽
    Router::addGroup('/sandbox', static function () {
        Router::get('/status', [MagicClawApi::class, 'getSandboxStatus']);
        Router::delete('', [MagicClawApi::class, 'stopSandbox']);
        Router::put('/upgrade', [MagicClawApi::class, 'upgradeSandbox']);
        Router::get('/version-check', [MagicClawApi::class, 'checkSandboxVersion']);
    });
    Router::get('/{code}', [MagicClawApi::class, 'show']);
    Router::put('/{code}', [MagicClawApi::class, 'update']);
    Router::delete('/{code}', [MagicClawApi::class, 'destroy']);
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v1/super-agents', static function () {
    Router::get('/featured', [SuperMagicAgentApi::class, 'getFeatured']);
    Router::get('/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'getPlaybook']);
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);
