<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Admin\Facade\Agent\AdminAgentApi;
use App\Interfaces\Admin\Facade\Agent\AgentGlobalSettingsApi;
use App\Interfaces\Admin\Facade\AppMenu\AppMenuAdminApi;
use App\Interfaces\Asset\Facade\AdminAssetApi;
use App\Interfaces\Asset\Facade\AdminPersonaAvatarApi;
use App\Interfaces\Audit\Facade\AdminOperationLogApi;
use App\Interfaces\Contact\Facade\Admin\PlatformUserApi;
use App\Interfaces\Kernel\Facade\ModelBillingMultiplierApi;
use App\Interfaces\Kernel\Facade\ModelBillingPreviewApi;
use App\Interfaces\Kernel\Facade\PlatformSettingsApi;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use App\Interfaces\OrganizationEnvironment\Facade\Admin\OrganizationApi;
use App\Interfaces\Permission\Facade\FunctionPermissionAdminApi;
use App\Interfaces\Permission\Facade\ModelAccessRoleApi;
use App\Interfaces\Permission\Facade\OrganizationAdminApi;
use App\Interfaces\Permission\Facade\PermissionApi;
use App\Interfaces\Permission\Facade\RoleApi;
use App\Interfaces\Provider\Facade\AiAbilityApi;
use App\Interfaces\Provider\Facade\ModelIdentifierMappingApi;
use App\Interfaces\Provider\Facade\ServiceProviderApi;
use App\Interfaces\SlidesTemplate\Facade\AdminSlidesTemplateApi;
use App\Interfaces\SlidesTemplate\Facade\AdminSlidesTemplateCategoryApi;
use App\Interfaces\SlidesTemplate\Facade\AdminSlidesTemplateTagApi;
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
        Router::post('/connectivity-tests/config-based', [ServiceProviderApi::class, 'connectivityTestByConfig']);
        Router::post('/by-category', [ServiceProviderApi::class, 'getOrganizationProvidersByCategory']);
        Router::post('/search', [ServiceProviderApi::class, 'searchProviderConfigs']);
        Router::get('/office-info', [ServiceProviderApi::class, 'isCurrentOrganizationOfficial']);
        Router::get('/templates/queries', [ServiceProviderApi::class, 'queriesServiceProviderTemplates']);
        Router::get('/model-pricing-templates/queries', [ServiceProviderApi::class, 'queriesProviderModelPricingTemplates']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 模型视角管理
    Router::addGroup('/provider-models', static function () {
        Router::post('/queries', [ServiceProviderApi::class, 'queriesProviderModels']);
        Router::post('/groups/queries', [ServiceProviderApi::class, 'queriesProviderModelGroups']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 官方模型标识映射。静态批量和候选路由必须先于 groupId 动态路由注册。
    Router::addGroup('/model-identifier-mappings', static function () {
        Router::post('/queries', [ModelIdentifierMappingApi::class, 'query']);
        Router::post('', [ModelIdentifierMappingApi::class, 'create']);
        Router::post('/batch-status', [ModelIdentifierMappingApi::class, 'batchStatus']);
        Router::post('/batch-delete', [ModelIdentifierMappingApi::class, 'batchDelete']);
        Router::get('/source-options', [ModelIdentifierMappingApi::class, 'sourceOptions']);
        Router::get('/target-options', [ModelIdentifierMappingApi::class, 'targetOptions']);
        Router::get('/{groupId}', [ModelIdentifierMappingApi::class, 'get']);
        Router::put('/{groupId}', [ModelIdentifierMappingApi::class, 'update']);
        Router::put('/{groupId}/status', [ModelIdentifierMappingApi::class, 'updateStatus']);
        Router::delete('/{groupId}', [ModelIdentifierMappingApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // AI能力管理
    Router::addGroup('/ai-abilities', static function () {
        Router::get('', [AiAbilityApi::class, 'queries']);
        Router::get('/{code}', [AiAbilityApi::class, 'detail']);
        Router::put('/{code}', [AiAbilityApi::class, 'update']);
        Router::post('/connectivity-test', [AiAbilityApi::class, 'connectivityTest']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    //    Router::addGroup('/globals', static function () {
    //        Router::addGroup('/agents', static function () {
    // Router::put('/settings', [AgentGlobalSettingsApi::class, 'updateGlobalSettings']);
    // Router::get('/settings', [AgentGlobalSettingsApi::class, 'getGlobalSettings']);
    //        });
    //    }, ['middleware' => [RequestContextMiddleware::class]]);

    //    Router::addGroup('/agents', static function () {
    // Router::get('/published', [AdminAgentApi::class, 'getPublishedAgents']);
    // Router::post('/queries', [AdminAgentApi::class, 'queriesAgents']);
    // Router::get('/creators', [AdminAgentApi::class, 'getOrganizationAgentsCreators']);
    // Router::get('/{agentId}', [AdminAgentApi::class, 'getAgentDetail']);
    // Router::delete('/{agentId}', [AdminAgentApi::class, 'deleteAgent']);
    //    }, ['middleware' => [RequestContextMiddleware::class]]);

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
        Router::get('/permissions/tree-v1', [PermissionApi::class, 'getPermissionTreeV1']);
        Router::get('/sub-admins', [RoleApi::class, 'getSubAdminList']);
        Router::post('/sub-admins', [RoleApi::class, 'createSubAdmin']);
        Router::put('/sub-admins/{id}', [RoleApi::class, 'updateSubAdmin']);
        Router::delete('/sub-admins/{id}', [RoleApi::class, 'deleteSubAdmin']);
        Router::get('/sub-admins/{id}', [RoleApi::class, 'getSubAdminById']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 模型权限相关
    Router::addGroup('/model-access-roles', static function () {
        Router::get('/meta', [ModelAccessRoleApi::class, 'meta']);
        Router::post('/meta', [ModelAccessRoleApi::class, 'updateMeta']);
        Router::get('/available-models', [ModelAccessRoleApi::class, 'availableModels']);
        Router::post('/queries', [ModelAccessRoleApi::class, 'queries']);
        Router::get('/users/{userId}/summary', [ModelAccessRoleApi::class, 'userSummary']);
        Router::post('', [ModelAccessRoleApi::class, 'create']);
        Router::get('/{roleId:\d+}', [ModelAccessRoleApi::class, 'show']);
        Router::put('/{roleId:\d+}', [ModelAccessRoleApi::class, 'update']);
        Router::delete('/{roleId:\d+}', [ModelAccessRoleApi::class, 'destroy']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 操作日志相关
    Router::addGroup('/operation-logs', static function () {
        Router::get('', [AdminOperationLogApi::class, 'queries']);
        Router::get('/{id:\d+}', [AdminOperationLogApi::class, 'show']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 模型调用审计相关
    Router::addGroup('/model-audit-logs', static function () {
        Router::post('/list', [AdminOperationLogApi::class, 'listModelAudit']);
        Router::post('/statistics', [AdminOperationLogApi::class, 'modelAuditStatistics']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 用户搜索
    Router::addGroup('/users', static function () {
        Router::post('/search', [PlatformUserApi::class, 'search']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 组织列表
    Router::addGroup('/organizations', static function () {
        Router::get('', [OrganizationApi::class, 'queries']);
        Router::post('/search', [OrganizationApi::class, 'search']);
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

    Router::addGroup('/function-permissions', static function () {
        Router::get('/catalog', [FunctionPermissionAdminApi::class, 'catalog']);
        Router::get('', [FunctionPermissionAdminApi::class, 'queries']);
        Router::get('/settings', [FunctionPermissionAdminApi::class, 'settings']);
        Router::put('/settings', [FunctionPermissionAdminApi::class, 'updateSettings']);
        Router::put('/{functionCode}/enabled', [FunctionPermissionAdminApi::class, 'updateEnabled']);
        Router::get('/{functionCode}', [FunctionPermissionAdminApi::class, 'show']);
        Router::put('/{functionCode}', [FunctionPermissionAdminApi::class, 'save']);
        Router::post('/batch', [FunctionPermissionAdminApi::class, 'batchSave']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 幻灯片模板管理
    Router::addGroup('/slides-template-categories', static function () {
        Router::post('/queries', [AdminSlidesTemplateCategoryApi::class, 'queries']);
        Router::get('/{id:\d+}', [AdminSlidesTemplateCategoryApi::class, 'detail']);
        Router::post('', [AdminSlidesTemplateCategoryApi::class, 'create']);
        Router::put('/{id:\d+}', [AdminSlidesTemplateCategoryApi::class, 'update']);
        Router::put('/{id:\d+}/status', [AdminSlidesTemplateCategoryApi::class, 'updateStatus']);
        Router::put('/{id:\d+}/sort', [AdminSlidesTemplateCategoryApi::class, 'updateSort']);
        Router::delete('/{id:\d+}', [AdminSlidesTemplateCategoryApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    Router::addGroup('/slides-template-tags', static function () {
        Router::post('/queries', [AdminSlidesTemplateTagApi::class, 'queries']);
        Router::get('/tree', [AdminSlidesTemplateTagApi::class, 'tree']);
        Router::get('/{id:\d+}', [AdminSlidesTemplateTagApi::class, 'detail']);
        Router::post('', [AdminSlidesTemplateTagApi::class, 'create']);
        Router::put('/{id:\d+}', [AdminSlidesTemplateTagApi::class, 'update']);
        Router::put('/{id:\d+}/status', [AdminSlidesTemplateTagApi::class, 'updateStatus']);
        Router::put('/{id:\d+}/sort', [AdminSlidesTemplateTagApi::class, 'updateSort']);
        Router::delete('/{id:\d+}', [AdminSlidesTemplateTagApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    Router::addGroup('/slides-templates', static function () {
        Router::post('/queries', [AdminSlidesTemplateApi::class, 'queries']);
        Router::post('/reindex-vector-index', [AdminSlidesTemplateApi::class, 'reindexVectorIndex']);
        Router::get('/{id:\d+}', [AdminSlidesTemplateApi::class, 'detail']);
        Router::post('', [AdminSlidesTemplateApi::class, 'create']);
        Router::put('/{id:\d+}', [AdminSlidesTemplateApi::class, 'update']);
        Router::put('/{id:\d+}/tags', [AdminSlidesTemplateApi::class, 'updateTags']);
        Router::put('/{id:\d+}/status', [AdminSlidesTemplateApi::class, 'updateStatus']);
        Router::put('/{id:\d+}/sort', [AdminSlidesTemplateApi::class, 'updateSort']);
        Router::delete('/{id:\d+}', [AdminSlidesTemplateApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class]]);

    // 资产库管理：创建、查询、更新和删除公开资产。
    Router::addGroup('/assets', static function (): void {
        Router::post('', [AdminAssetApi::class, 'create']);
        Router::post('/queries', [AdminAssetApi::class, 'queries']);
        // 第三方素材 / 素材组占用数量（配额核对）。
        Router::get('/provider-resource-usage', [AdminAssetApi::class, 'providerResourceUsage']);
        Router::get('/tags', [AdminAssetApi::class, 'tags']);
        Router::post('/tags', [AdminAssetApi::class, 'createTag']);
        Router::put('/tags/{tagId:\d+}', [AdminAssetApi::class, 'updateTag']);
        Router::delete('/tags/{tagId:\d+}', [AdminAssetApi::class, 'deleteTag']);
        Router::patch('/{assetId:\d+}', [AdminAssetApi::class, 'update']);
        Router::delete('/{assetId:\d+}', [AdminAssetApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]);

    // 人设头像库管理：只管理业务类型为 PERSONA_AVATAR 的官方素材，暂无界面，供导入脚本使用。
    Router::addGroup('/persona-avatars', static function (): void {
        Router::post('', [AdminPersonaAvatarApi::class, 'create']);
        Router::post('/queries', [AdminPersonaAvatarApi::class, 'queries']);
        Router::patch('/{assetId:\d+}', [AdminPersonaAvatarApi::class, 'update']);
        Router::delete('/{assetId:\d+}', [AdminPersonaAvatarApi::class, 'delete']);
    }, ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]);
});

// 平台设置（管理端）
Router::addGroup('/api/v1/platform', static function () {
    Router::get('/setting', [PlatformSettingsApi::class, 'show']);
    Router::get('/setting/model-billing-multiplier', [ModelBillingMultiplierApi::class, 'show']);
    Router::put('/setting/model-billing-multiplier', [ModelBillingMultiplierApi::class, 'update']);
    Router::get('/setting/model-billing-preview', [ModelBillingPreviewApi::class, 'show']);
    Router::put('/setting', [PlatformSettingsApi::class, 'update']);
}, ['middleware' => [RequestContextMiddleware::class]]);
