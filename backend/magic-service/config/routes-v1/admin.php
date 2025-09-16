<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Admin\Facade\Agent\AdminAgentApi;
use App\Interfaces\Admin\Facade\Agent\AgentGlobalSettingsApi;
use App\Interfaces\Permission\Facade\OrganizationAdminApi;
use App\Interfaces\Permission\Facade\PermissionApi;
use App\Interfaces\Permission\Facade\RoleApi;
use App\Interfaces\Provider\Facade\Open\ServiceProviderOpenApi;
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use Hyperf\HttpServer\Router\Router;

// 不校验管理员权限的路由组
Router::addGroup('/api/v1', static function () {
    Router::addGroup('/service-providers', static function () {
        // 按分类获取服务商（不校验管理员权限）
        Router::post('/category', [ServiceProviderOpenApi::class, 'getProvidersByCategory']);
        Router::post('/by-category', [ServiceProviderOpenApi::class, 'getProvidersByCategory']);
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
        Router::post('/models/queries', [ServiceProviderApi::class, 'queriesModels']); // 根据模型类型，模型状态获取模型

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

    // 组织管理员
    Router::addGroup('/organization-admin', static function () {
        Router::get('/list', [OrganizationAdminApi::class, 'list']);
        Router::get('/{id:\d+}', [OrganizationAdminApi::class, 'show']);
        Router::delete('/{id:\d+}', [OrganizationAdminApi::class, 'destroy']);
        Router::post('/grant', [OrganizationAdminApi::class, 'grant']);
        Router::post('/transfer-owner', [OrganizationAdminApi::class, 'transferOwner']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 角色权限相关（权限树）
    Router::addGroup('/roles', static function () {
        Router::get('/permissions/tree', [PermissionApi::class, 'getPermissionTree']);
        Router::get('/sub-admins', [RoleApi::class, 'getSubAdminList']);
        Router::post('/sub-admins', [RoleApi::class, 'createSubAdmin']);
        Router::put('/sub-admins/{id}', [RoleApi::class, 'updateSubAdmin']);
        Router::delete('/sub-admins/{id}', [RoleApi::class, 'deleteSubAdmin']);
        Router::get('/sub-admins/{id}', [RoleApi::class, 'getSubAdminById']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
});
