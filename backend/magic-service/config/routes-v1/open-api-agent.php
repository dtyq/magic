<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\SandboxUserAuthMiddleware;
use App\Interfaces\SuperMagic\Facade\Agent\ProjectFileApi;
use App\Interfaces\SuperMagic\Facade\Agent\UserApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/open-api/agent', static function () {
    Router::get('/users/me', [UserApi::class, 'show']);
    Router::post('/projects/{id}/files/query', [ProjectFileApi::class, 'index']);
}, ['middleware' => [SandboxUserAuthMiddleware::class]]);
