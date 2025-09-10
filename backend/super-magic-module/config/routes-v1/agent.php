<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin\SuperMagicAgentAdminApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/super-magic', function () {
    Router::addGroup('/agents', function () {
        Router::get('/builtin-tools', [SuperMagicAgentAdminApi::class, 'tools']);

        Router::post('', [SuperMagicAgentAdminApi::class, 'save']);
        Router::post('/queries', [SuperMagicAgentAdminApi::class, 'queries']);
        Router::post('/ai-optimize', [SuperMagicAgentAdminApi::class, 'aiOptimize']);
        Router::get('/{code}', [SuperMagicAgentAdminApi::class, 'show']);
        Router::delete('/{code}', [SuperMagicAgentAdminApi::class, 'destroy']);
        Router::put('/{code}/enable', [SuperMagicAgentAdminApi::class, 'enable']);
        Router::put('/{code}/disable', [SuperMagicAgentAdminApi::class, 'disable']);
        Router::post('/order', [SuperMagicAgentAdminApi::class, 'saveOrder']);
    });
});
