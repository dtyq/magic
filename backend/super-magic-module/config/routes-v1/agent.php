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

// 旧版本接口，待新版本完全上线后可移除该分组。
Router::addGroup('/api/v1/super-magic', static function () {
    Router::addGroup('/agents', static function () {
        // 旧版接口：创建或更新智能体。
        Router::post('', [SuperMagicAgentOldApi::class, 'save']);
        // 按条件查询旧版智能体列表。
        Router::post('/queries', [SuperMagicAgentOldApi::class, 'queries']);
        // 旧版流程：使用 AI 优化智能体内容。
        Router::post('/ai-optimize', [SuperMagicAgentOldApi::class, 'aiOptimize']);
        // 保存旧版智能体展示顺序。
        Router::post('/order', [SuperMagicAgentOldApi::class, 'saveOrder']);
        // 静态路由必须定义在变量路由前，否则会被 /{code} 覆盖。
        // 获取智能体配置可用的内置工具。
        Router::get('/builtin-tools', [SuperMagicAgentOldApi::class, 'tools']);
        // 获取智能体配置可用的内置技能。
        Router::get('/builtin-skills', [SuperMagicAgentOldApi::class, 'skills']);
        // 根据 code 获取旧版智能体详情。
        Router::get('/{code}', [SuperMagicAgentOldApi::class, 'show']);
        // 根据 code 删除智能体。
        Router::delete('/{code}', [SuperMagicAgentApi::class, 'destroy']);
        // 启用旧版智能体。
        Router::put('/{code}/enable', [SuperMagicAgentOldApi::class, 'enable']);
        // 停用旧版智能体。
        Router::put('/{code}/disable', [SuperMagicAgentOldApi::class, 'disable']);
    });
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);

Router::addGroup('/api/v2/super-magic', static function () {
    Router::addGroup('/agents', static function () {
        // 获取精选智能体排序列表。
        Router::get('/featured/sort-list', [SuperMagicAgentApi::class, 'sortListQueries']);
        // 将智能体标记为高频使用。
        Router::put('/featured/frequent', [SuperMagicAgentApi::class, 'addToFrequent']);
        // 按高级条件查询智能体列表。
        Router::post('/queries', [SuperMagicAgentApi::class, 'queries']);
        // 查询我创建的智能体列表。
        Router::post('/queries/created', [SuperMagicAgentApi::class, 'queriesCreated']);
        // 查询团队共享的智能体列表。
        Router::post('/queries/team-shared', [SuperMagicAgentApi::class, 'queriesTeamShared']);
        // 查询从市场安装的智能体列表。
        Router::post('/queries/market-installed', [SuperMagicAgentApi::class, 'queriesMarketInstalled']);
        // 查询外部/公开智能体列表。
        Router::post('/external/queries', [SuperMagicAgentApi::class, 'externalQueries']);
        // 从外部数据导入智能体。
        Router::post('/import', [SuperMagicAgentApi::class, 'import']);
        // 创建智能体。
        Router::post('', [SuperMagicAgentApi::class, 'create']);
        // 根据 code 更新智能体信息。
        Router::put('/{code}', [SuperMagicAgentApi::class, 'update']);
        // 刷新智能体 updated_at 时间戳。
        Router::put('/{code}/updated-at', [SuperMagicAgentApi::class, 'touchUpdatedAt']);
        // 获取编辑时可提及的技能列表。
        Router::get('/mention-skills', [SuperMagicAgentApi::class, 'getMentionSkills']);
        // 获取智能体全部版本。
        Router::get('/{code}/versions', [SuperMagicAgentApi::class, 'getVersionList']);
        // 根据 code 获取智能体详情。
        Router::get('/{code}', [SuperMagicAgentApi::class, 'show']);
        // 根据 code 删除智能体。
        Router::delete('/{code}', [SuperMagicAgentApi::class, 'destroy']);
        // 获取发布前预填充数据。
        Router::get('/{code}/publish/prefill', [SuperMagicAgentApi::class, 'getPublishPrefill']);
        // 发布智能体到市场。
        Router::post('/{code}/publish', [SuperMagicAgentApi::class, 'publishAgent']);
        //        Router::post('/{code}/export', [SuperMagicAgentApi::class, 'export']);
        //        Router::put('/{code}/project', [SuperMagicAgentApi::class, 'bindProject']);

        // Playbook 管理相关接口。
        // 为指定智能体创建 playbook。
        Router::post('/{code}/playbooks', [SuperMagicAgentPlaybookApi::class, 'createPlaybook']);
        // 调整指定智能体下全部 playbook 顺序。
        Router::put('/{code}/playbooks/reorder', [SuperMagicAgentPlaybookApi::class, 'reorderPlaybooks']);
        // 切换 playbook 启用状态。
        Router::put('/{code}/playbooks/{playbookId}/enabled', [SuperMagicAgentPlaybookApi::class, 'togglePlaybookEnabled']);
        // 更新单个 playbook。
        Router::put('/{code}/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'updatePlaybook']);
        // 获取单个 playbook 详情。
        Router::get('/{code}/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'getPlaybook']);
        // 删除智能体下的指定 playbook。
        Router::delete('/{code}/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'deletePlaybook']);
        // 获取指定智能体下全部 playbook。
        Router::get('/{code}/playbooks', [SuperMagicAgentPlaybookApi::class, 'getAgentPlaybooks']);

        // 技能管理相关接口。
        // Router::put('/{code}/skills', [SuperMagicAgentApi::class, 'updateAgentSkills']);
        // 为智能体新增技能。
        Router::post('/{code}/skills', [SuperMagicAgentApi::class, 'addAgentSkills']);
        // 从智能体移除技能。
        Router::delete('/{code}/skills', [SuperMagicAgentApi::class, 'removeAgentSkills']);
    });

    Router::addGroup('/agent-market', static function () {
        // 查询智能体市场列表。
        Router::post('/queries', [SuperMagicAgentMarketApi::class, 'queries']);
        // 获取市场全部分类。
        Router::get('/categories', [SuperMagicAgentMarketApi::class, 'getCategories']);
        // 根据 code 获取市场智能体详情。
        Router::get('/{code}', [SuperMagicAgentMarketApi::class, 'show']);
        // 从市场雇佣智能体。
        Router::post('/{code}/hire', [SuperMagicAgentApi::class, 'hireAgent']);
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
    // 获取首页精选超级智能体。
    Router::get('/featured', [SuperMagicAgentApi::class, 'getFeatured']);
    // 根据 playbookId 获取 playbook 详情。
    Router::get('/playbooks/{playbookId}', [SuperMagicAgentPlaybookApi::class, 'getPlaybook']);
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);
