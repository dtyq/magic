<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Flow\Facade\Admin\MagicFlowAIModelFlowAdminApi;
use App\Interfaces\Flow\Facade\Admin\MagicFlowApiKeyFlowAdminApi;
use App\Interfaces\Flow\Facade\Admin\MagicFlowDraftFlowAdminApi;
use App\Interfaces\Flow\Facade\Admin\MagicFlowFlowAdminApi;
use App\Interfaces\Flow\Facade\Admin\MagicFlowToolSetApiFlow;
use App\Interfaces\Flow\Facade\Admin\MagicFlowTriggerTestcaseFlowAdminApi;
use App\Interfaces\Flow\Facade\Admin\MagicFlowVersionFlowAdminApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/flows', static function () {
        Router::get('/models', [MagicFlowAIModelFlowAdminApi::class, 'getEnabled']);
        Router::get('/node-versions', [MagicFlowFlowAdminApi::class, 'nodeVersions']);
        Router::post('/node-template', [MagicFlowFlowAdminApi::class, 'nodeTemplate']);
        Router::post('/node-debug', [MagicFlowFlowAdminApi::class, 'singleDebugNode']);
        Router::post('/{flowId}/flow-debug', [MagicFlowFlowAdminApi::class, 'flowDebug']);
        Router::post('', [MagicFlowFlowAdminApi::class, 'saveFlow']);
        Router::post('/queries', [MagicFlowFlowAdminApi::class, 'queries']);
        Router::post('/queries/tools', [MagicFlowFlowAdminApi::class, 'queryTools']);
        Router::post('/queries/tool-sets', [MagicFlowFlowAdminApi::class, 'queryToolSets']);
        Router::post('/queries/mcp-list', [MagicFlowFlowAdminApi::class, 'queryMCPList']);
        Router::post('/queries/knowledge', [MagicFlowFlowAdminApi::class, 'queryKnowledge']);
        Router::get('/{flowId}', [MagicFlowFlowAdminApi::class, 'show']);
        Router::get('/{flowId}/params', [MagicFlowFlowAdminApi::class, 'showParams']);
        Router::delete('/{flowId}', [MagicFlowFlowAdminApi::class, 'remove']);
        Router::post('/{flowId}/change-enable', [MagicFlowFlowAdminApi::class, 'changeEnable']);
        Router::post('/expression-data-source', [MagicFlowFlowAdminApi::class, 'expressionDataSource']);

        // 草稿箱
        Router::post('/{flowId}/draft', [MagicFlowDraftFlowAdminApi::class, 'save']);
        Router::post('/{flowId}/draft/queries', [MagicFlowDraftFlowAdminApi::class, 'queries']);
        Router::get('/{flowId}/draft/{draftId}', [MagicFlowDraftFlowAdminApi::class, 'show']);
        Router::delete('/{flowId}/draft/{draftId}', [MagicFlowDraftFlowAdminApi::class, 'remove']);

        // 版本
        Router::post('/{flowId}/version/publish', [MagicFlowVersionFlowAdminApi::class, 'publish']);
        Router::post('/{flowId}/version/queries', [MagicFlowVersionFlowAdminApi::class, 'queries']);
        Router::get('/{flowId}/version/{versionId}', [MagicFlowVersionFlowAdminApi::class, 'show']);
        Router::post('/{flowId}/version/{versionId}/rollback', [MagicFlowVersionFlowAdminApi::class, 'rollback']);

        // 测试集
        Router::post('/{flowId}/testcase', [MagicFlowTriggerTestcaseFlowAdminApi::class, 'save']);
        Router::post('/{flowId}/testcase/queries', [MagicFlowTriggerTestcaseFlowAdminApi::class, 'queries']);
        Router::get('/{flowId}/testcase/{testcaseId}', [MagicFlowTriggerTestcaseFlowAdminApi::class, 'show']);
        Router::delete('/{flowId}/testcase/{testcaseId}', [MagicFlowTriggerTestcaseFlowAdminApi::class, 'remove']);

        // 工具集
        Router::post('/tool-set', [MagicFlowToolSetApiFlow::class, 'save']);
        Router::post('/tool-set/queries', [MagicFlowToolSetApiFlow::class, 'queries']);
        Router::get('/tool-set/{code}', [MagicFlowToolSetApiFlow::class, 'show']);
        Router::delete('/tool-set/{code}', [MagicFlowToolSetApiFlow::class, 'destroy']);

        // API_KEY 管理
        Router::post('/{flowId}/api-key', [MagicFlowApiKeyFlowAdminApi::class, 'save']);
        Router::post('/{flowId}/api-key/queries', [MagicFlowApiKeyFlowAdminApi::class, 'queries']);
        Router::get('/{flowId}/api-key/{code}', [MagicFlowApiKeyFlowAdminApi::class, 'show']);
        Router::delete('/{flowId}/api-key/{code}', [MagicFlowApiKeyFlowAdminApi::class, 'destroy']);
        Router::post('/{flowId}/api-key/{code}/rebuild', [MagicFlowApiKeyFlowAdminApi::class, 'changeSecretKey']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
