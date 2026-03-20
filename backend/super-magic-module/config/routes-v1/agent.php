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

// 旧版本，新版本上线后可删除
Router::addGroup('/api/v1/super-magic', static function () {
    Router::addGroup('/agents', static function () {
        Router::post('', [SuperMagicAgentOldApi::class, 'save']);
        Router::post('/queries', [SuperMagicAgentOldApi::class, 'queries']);
        Router::post('/ai-optimize', [SuperMagicAgentOldApi::class, 'aiOptimize']);
        Router::post('/order', [SuperMagicAgentOldApi::class, 'saveOrder']);
        // 静态路由必须放在变量路由之前，否则会被 /{code} 遮蔽
        Router::get('/builtin-tools', [SuperMagicAgentOldApi::class, 'tools']);
        Router::get('/{code}', [SuperMagicAgentOldApi::class, 'show']);
        Router::delete('/{code}', [SuperMagicAgentOldApi::class, 'destroy']);
        Router::put('/{code}/enable', [SuperMagicAgentOldApi::class, 'enable']);
        Router::put('/{code}/disable', [SuperMagicAgentOldApi::class, 'disable']);
    });
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v2/super-magic', static function () {
    Router::addGroup('/agents', static function () {
        Router::post('/queries', [SuperMagicAgentApi::class, 'queries']);
        Router::post('', [SuperMagicAgentApi::class, 'create']);
        Router::put('/{code}', [SuperMagicAgentApi::class, 'update']);
        Router::put('/{code}/updated-at', [SuperMagicAgentApi::class, 'touchUpdatedAt']);
        Router::get('/{code}/versions', [SuperMagicAgentApi::class, 'getVersionList']);
        Router::get('/{code}', [SuperMagicAgentApi::class, 'show']);
        Router::delete('/{code}', [SuperMagicAgentOldApi::class, 'destroy']);
        Router::post('/{code}/publish', [SuperMagicAgentApi::class, 'publishAgent']);
        Router::post('/{code}/export', [SuperMagicAgentApi::class, 'export']);
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
        Router::put('/{code}/skills', [SuperMagicAgentApi::class, 'updateAgentSkills']);
        Router::post('/{code}/skills', [SuperMagicAgentApi::class, 'addAgentSkills']);
        Router::delete('/{code}/skills', [SuperMagicAgentApi::class, 'removeAgentSkills']);
    });

    Router::addGroup('/agent-market', static function () {
        Router::post('/queries', [SuperMagicAgentMarketApi::class, 'queries']);
        Router::post('/{code}/hire', [SuperMagicAgentMarketApi::class, 'hireAgent']);
        Router::get('/categories', [SuperMagicAgentMarketApi::class, 'getCategories']);
    });
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v1/magic-claw', static function () {
    Router::post('/queries', [MagicClawApi::class, 'queries']); // static route must be before /{code}
    Router::post('', [MagicClawApi::class, 'create']);
    Router::get('/{code}', [MagicClawApi::class, 'show']);
    Router::put('/{code}', [MagicClawApi::class, 'update']);
    Router::delete('/{code}', [MagicClawApi::class, 'destroy']);
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v1/super-agents', static function () {
    Router::get('/featured', [SuperMagicAgentApi::class, 'getFeatured']);
    Router::get('/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'getPlaybook']);
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);
