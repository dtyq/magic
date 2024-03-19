<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin\SuperMagicAgentAdminApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v2/admin', static function () {
    Router::addGroup('/super-magic/agents', static function () {
        Router::get('/{code}', [SuperMagicAgentAdminApi::class, 'getDetailByCode']);
        Router::put('/versions/{id}/review', [SuperMagicAgentAdminApi::class, 'reviewAgentVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
