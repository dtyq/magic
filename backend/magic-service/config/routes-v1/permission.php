<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\SandboxUserAuthMiddleware;
use App\Interfaces\Permission\Facade\OperationPermissionApi;
use App\Interfaces\Permission\Facade\PermissionApi;
use App\Interfaces\Permission\Facade\ResourceVisibilityApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/operation-permissions', static function () {
        Router::post('/transfer-owner', [OperationPermissionApi::class, 'transferOwner']);
        Router::post('/resource-access', [OperationPermissionApi::class, 'resourceAccess']);
        Router::get('/resource-access', [OperationPermissionApi::class, 'listResource']);
        Router::get('/organization-admin', [OperationPermissionApi::class, 'checkOrganizationAdmin']);
        Router::get('/organizations/admin', [OperationPermissionApi::class, 'getUserOrganizationAdminList']);
    });

    Router::addGroup('/permissions', static function () {
        Router::get('/me', [PermissionApi::class, 'getUserPermissions']);
    });

    Router::addGroup('/resource-visibility', static function () {
        Router::post('', [ResourceVisibilityApi::class, 'saveResourceVisibility']);
        Router::get('', [ResourceVisibilityApi::class, 'listResourceVisibility']);
        Router::post('/config', [ResourceVisibilityApi::class, 'saveVisibilityConfig']);
        Router::get('/config', [ResourceVisibilityApi::class, 'getVisibilityConfig']);
    });
}, ['middleware' => [RequestContextMiddleware::class, SandboxUserAuthMiddleware::class]]);
