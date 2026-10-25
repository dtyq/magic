<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\MagicBase\Facade\MagicBaseApi;
use App\Interfaces\Middleware\Auth\OptionalUserAuthMiddleware;
use Hyperf\HttpServer\Router\Router;

// Read routes still validate the share token, project and table/row/column permissions
// in MagicBaseApi. Optional login must never extend to data writes or administration.
Router::addGroup('/api/v1/magicbase/projects/{projectId}', static function () {
    Router::get('/tables', [MagicBaseApi::class, 'listTables']);
    Router::get('/tables/{tableId}', [MagicBaseApi::class, 'getTable']);
    Router::post('/tables/{tableId}/query', [MagicBaseApi::class, 'queryRows']);
    Router::get('/tables/{tableId}/rows/{recordId}', [MagicBaseApi::class, 'getRow']);
}, ['middleware' => [OptionalUserAuthMiddleware::class]]);

Router::addGroup('/api/v1', static function () {
    Router::addGroup('/magicbase/projects/{projectId}', static function () {
        Router::get('/admin-access', [MagicBaseApi::class, 'getProjectAdminAccess']);
        Router::post('/tables', [MagicBaseApi::class, 'createTable']);
        Router::patch('/tables/{tableId}', [MagicBaseApi::class, 'updateTable']);
        Router::delete('/tables/{tableId}', [MagicBaseApi::class, 'deleteTable']);

        Router::post('/tables/{tableId}/columns', [MagicBaseApi::class, 'createColumn']);
        Router::patch('/tables/{tableId}/columns/{columnId}', [MagicBaseApi::class, 'updateColumn']);
        Router::delete('/tables/{tableId}/columns/{columnId}', [MagicBaseApi::class, 'deleteColumn']);

        Router::post('/tables/{tableId}/rows', [MagicBaseApi::class, 'createRow']);
        Router::post('/tables/{tableId}/rows/batch', [MagicBaseApi::class, 'batchCreateRows']);
        Router::post('/tables/{tableId}/rows/batch-delete', [MagicBaseApi::class, 'batchDeleteRows']);
        Router::patch('/tables/{tableId}/rows/{recordId}', [MagicBaseApi::class, 'updateRow']);
        Router::delete('/tables/{tableId}/rows/{recordId}', [MagicBaseApi::class, 'deleteRow']);

        Router::post('/relations', [MagicBaseApi::class, 'createRelation']);
        Router::get('/relations', [MagicBaseApi::class, 'listRelations']);
        Router::patch('/relations/{relationId}', [MagicBaseApi::class, 'updateRelation']);
        Router::delete('/relations/{relationId}', [MagicBaseApi::class, 'deleteRelation']);

        Router::post('/admins/project', [MagicBaseApi::class, 'createProjectAdmin']);
        Router::post('/tables/{tableId}/admins', [MagicBaseApi::class, 'createTableAdmin']);
        Router::get('/tables/{tableId}/permissions', [MagicBaseApi::class, 'listPermissions']);
        Router::post('/tables/{tableId}/permissions/batch', [MagicBaseApi::class, 'batchSavePermissions']);
        Router::delete('/tables/{tableId}/permissions/{type}/{permissionId}', [MagicBaseApi::class, 'deletePermission']);
        Router::post('/tables/{tableId}/permissions/table', [MagicBaseApi::class, 'createTablePermission']);
        Router::post('/tables/{tableId}/permissions/columns', [MagicBaseApi::class, 'createColumnPermission']);
        Router::post('/tables/{tableId}/permissions/rows', [MagicBaseApi::class, 'createRowPermission']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
