<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Provider\Facade\OrganizationServiceProviderApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/organization/admin', static function () {
    Router::addGroup('/service-providers', static function () {
        // 服务商管理
        Router::get('', [OrganizationServiceProviderApi::class, 'getServiceProviders']);
        Router::get('/{serviceProviderConfigId:\d+}', [OrganizationServiceProviderApi::class, 'getServiceProviderConfigModels']);
        Router::put('', [OrganizationServiceProviderApi::class, 'updateServiceProviderConfig']);
        Router::post('', [OrganizationServiceProviderApi::class, 'addServiceProviderForOrganization']);
        Router::delete('/{serviceProviderConfigId:\d+}', [OrganizationServiceProviderApi::class, 'deleteServiceProviderForOrganization']);

        // 模型管理
        Router::post('/models', [OrganizationServiceProviderApi::class, 'saveModelToServiceProvider']);
        Router::get('/models/{modelId}', [OrganizationServiceProviderApi::class, 'getModelDetail']); // 获取模型详情
        Router::delete('/models/{modelId}', [OrganizationServiceProviderApi::class, 'deleteModel']);
        Router::put('/models/{modelId}/status', [OrganizationServiceProviderApi::class, 'updateModelStatus']);
        Router::post('/models/queries', [OrganizationServiceProviderApi::class, 'queriesModels']); // 根据模型类型，模型状态获取模型

        // 模型标识管理
        Router::post('/model-id', [OrganizationServiceProviderApi::class, 'addModelIdForOrganization']);
        Router::delete('/model-ids/{modelId}', [OrganizationServiceProviderApi::class, 'deleteModelIdForOrganization']);

        // 原始模型管理
        Router::get('/original-models', [OrganizationServiceProviderApi::class, 'listOriginalModels']);
        Router::post('/original-models', [OrganizationServiceProviderApi::class, 'addOriginalModel']);

        // 其他功能
        Router::post('/connectivity-test', [OrganizationServiceProviderApi::class, 'connectivityTest']);
        Router::post('/connectivity-tests/config-based', [OrganizationServiceProviderApi::class, 'connectivityTestByConfig']);
        Router::post('/by-category', [OrganizationServiceProviderApi::class, 'getOrganizationProvidersByCategory']);
        Router::get('/templates/queries', [OrganizationServiceProviderApi::class, 'queriesServiceProviderTemplates']);
        Router::get('/office-info', [OrganizationServiceProviderApi::class, 'isCurrentOrganizationOfficial']);

        Router::get('/available-llm', [OrganizationServiceProviderApi::class, 'getAllAvailableLlmProviders']);
        Router::get('/non-official-llm', [OrganizationServiceProviderApi::class, 'getNonOfficialLlmProviders']);
        Router::get('/non-official/queries', [OrganizationServiceProviderApi::class, 'queriesServiceProviderTemplates']);
    }, ['middleware' => [RequestContextMiddleware::class]]);
}, ['middleware' => [RequestContextMiddleware::class]]);
