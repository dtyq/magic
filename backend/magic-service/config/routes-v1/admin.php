<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Admin\Facade\Agent\AdminAgentApi;
use App\Interfaces\Admin\Facade\Agent\AgentGlobalSettingsApi;
use App\Interfaces\Admin\Facade\AppMenu\AppMenuAdminApi;
use App\Interfaces\Audit\Facade\AdminOperationLogApi;
use App\Interfaces\Contact\Facade\Admin\PlatformUserApi;
use App\Interfaces\Kernel\Facade\PlatformSettingsApi;
use App\Interfaces\ModelGateway\Facade\Open\OpenAIProxyApi;
use App\Interfaces\OrganizationEnvironment\Facade\Admin\OrganizationApi;
use App\Interfaces\Permission\Facade\OrganizationAdminApi;
use App\Interfaces\Permission\Facade\PermissionApi;
use App\Interfaces\Permission\Facade\RoleApi;
use App\Interfaces\Provider\Facade\AiAbilityApi;
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use Hyperf\HttpServer\Router\Router;

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
        Router::get('/models/{modelId}', [ServiceProviderApi::class, 'getModelDetail']); // 获取模型详情
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
        Router::post('/ability-connectivity-test', [OpenAIProxyApi::class, 'connectivityTest']);
        Router::post('/connectivity-tests/config-based', [ServiceProviderApi::class, 'connectivityTestByConfig']);
        Router::post('/by-category', [ServiceProviderApi::class, 'getOrganizationProvidersByCategory']);
        Router::get('/office-info', [ServiceProviderApi::class, 'isCurrentOrganizationOfficial']);
        Router::get('/templates/queries', [ServiceProviderApi::class, 'queriesServiceProviderTemplates']);

        // 废弃，上线后可删除
        Router::get('/available-llm', [ServiceProviderApi::class, 'getAllAvailableLlmProviders']);
        Router::get('/non-official-llm', [ServiceProviderApi::class, 'getNonOfficialLlmProviders']);
        Router::get('/non-official/queries', [ServiceProviderApi::class, 'queriesServiceProviderTemplates']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // AI能力管理
    Router::addGroup('/ai-abilities', static function () {
        Router::get('', [AiAbilityApi::class, 'queries']);
        Router::get('/{code}', [AiAbilityApi::class, 'detail']);
        Router::put('/{code}', [AiAbilityApi::class, 'update']);
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

    // 操作日志相关
    Router::addGroup('/operation-logs', static function () {
        Router::get('', [AdminOperationLogApi::class, 'queries']);
        Router::get('/{id:\d+}', [AdminOperationLogApi::class, 'show']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 组织列表
    Router::addGroup('/organizations', static function () {
        Router::get('', [OrganizationApi::class, 'queries']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 平台用户列表
    Router::addGroup('/platform-users', static function () {
        Router::post('/queries', [PlatformUserApi::class, 'queries']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 应用菜单管理
    Router::addGroup('/applications', static function () {
        Router::post('/queries', [AppMenuAdminApi::class, 'queries']);
        Router::post('/status', [AppMenuAdminApi::class, 'status']);
        Router::get('/{id:\d+}', [AppMenuAdminApi::class, 'show']);
        Router::post('/save', [AppMenuAdminApi::class, 'save']);
        Router::post('/delete', [AppMenuAdminApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
});

// 平台设置（管理端）
Router::addGroup('/api/v1/platform', static function () {
    Router::get('/setting', [PlatformSettingsApi::class, 'show']);
    Router::put('/setting', [PlatformSettingsApi::class, 'update']);
}, ['middleware' => [RequestContextMiddleware::class]]);
