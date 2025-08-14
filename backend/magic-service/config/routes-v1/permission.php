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

    Router::addGroup('/permissions', static function () {
        Router::get('/me', [PermissionApi::class, 'getUserPermissions']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
