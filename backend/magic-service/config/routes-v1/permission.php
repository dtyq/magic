<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Permission\Facade\OperationPermissionApi;
use App\Interfaces\Permission\Facade\PermissionApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/operation-permissions', static function () {
        Router::post('/transfer-owner', [OperationPermissionApi::class, 'transferOwner']);
        Router::post('/resource-access', [OperationPermissionApi::class, 'resourceAccess']);
        Router::get('/resource-access', [OperationPermissionApi::class, 'listResource']);
        Router::get('/organization-admin', [OperationPermissionApi::class, 'checkOrganizationAdmin']);
        Router::get('/organizations/admin', [OperationPermissionApi::class, 'getUserOrganizationAdminList']);
    });

    // 角色权限相关（权限树）
    Router::addGroup('/roles', static function () {
        Router::get('/permissions/tree', [PermissionApi::class, 'getPermissionTree']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
