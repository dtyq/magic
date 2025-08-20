<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Admin\Facade\Agent\AdminAgentApi;
use App\Interfaces\Admin\Facade\Agent\AgentGlobalSettingsApi;
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use Hyperf\HttpServer\Router\Router;

// 不校验管理员权限的路由组
Router::addGroup('/api/v1', static function () {
    Router::addGroup('/service-providers', static function () {
        // 按分类获取服务商（不校验管理员权限）
        Router::post('/category', [ServiceProviderApi::class, 'getOrganizationProvidersByCategory']);
        Router::post('/by-category', [ServiceProviderApi::class, 'getOrganizationProvidersByCategory']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

// 组织管理后台路由
Router::addGroup('/api/v1/admin', static function () {
    Router::addGroup('/service-providers', static function () {
        // 服务商管理
        Router::get('', [ServiceProviderApi::class, 'getServiceProviders']);
        Router::get('/{serviceProviderConfigId:\d+}', [ServiceProviderApi::class, 'getServiceProviderConfigModels']);
        Router::put('', [ServiceProviderApi::class, 'updateServiceProviderConfig']);
        Router::post('', [ServiceProviderApi::class, 'addServiceProviderForOrganization']);
        Router::delete('/{serviceProviderConfigId:\d+}', [ServiceProviderApi::class, 'deleteServiceProviderForOrganization']);

        // 模型管理
        Router::post('/models', [ServiceProviderApi::class, 'saveModelToServiceProvider']);
        Router::delete('/models/{modelId}', [ServiceProviderApi::class, 'deleteModel']);
        Router::put('/models/{modelId}/status', [ServiceProviderApi::class, 'updateModelStatus']);

        // 模型标识管理
        Router::post('/model-id', [ServiceProviderApi::class, 'addModelIdForOrganization']);
        Router::delete('/model-ids/{modelId}', [ServiceProviderApi::class, 'deleteModelIdForOrganization']);

        // 原始模型管理
        Router::get('/original-models', [ServiceProviderApi::class, 'listOriginalModels']);
        Router::post('/original-models', [ServiceProviderApi::class, 'addOriginalModel']);

        // 其他功能
        Router::post('/connectivity-test', [ServiceProviderApi::class, 'connectivityTest']);
        Router::post('/by-category', [ServiceProviderApi::class, 'getOrganizationProvidersByCategory']);
        Router::get('/non-official-llm', [ServiceProviderApi::class, 'getNonOfficialLlmProviders']);
        Router::get('/office-info', [ServiceProviderApi::class, 'isCurrentOrganizationOfficial']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    Router::addGroup('/globals', static function () {
        Router::addGroup('/agents', static function () {
            Router::put('/settings', [AgentGlobalSettingsApi::class, 'updateGlobalSettings']);
            Router::get('/settings', [AgentGlobalSettingsApi::class, 'getGlobalSettings']);
        });
    }, ['middleware' => [RequestContextMiddleware::class]]);

    Router::addGroup('/agents', static function () {
        Router::get('/published', [AdminAgentApi::class, 'getPublishedAgents']);
        Router::post('/queries', [AdminAgentApi::class, 'queriesAgents']);
        Router::get('/creators', [AdminAgentApi::class, 'getOrganizationAgentsCreators']);
        Router::get('/{agentId}', [AdminAgentApi::class, 'getAgentDetail']);
        Router::delete('/{agentId}', [AdminAgentApi::class, 'deleteAgent']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
});
