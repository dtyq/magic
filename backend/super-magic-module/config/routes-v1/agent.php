<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin\SuperMagicAgentAdminApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/super-agent', function () {
    Router::addGroup('/agents', function () {
        // 创建或更新Agent
        Router::post('', [SuperMagicAgentAdminApi::class, 'save']);
        
        // 查询Agent列表
        Router::post('/queries', [SuperMagicAgentAdminApi::class, 'queries']);
        
        // 获取单个Agent详情
        Router::get('/{code}', [SuperMagicAgentAdminApi::class, 'show']);
        
        // 删除Agent
        Router::delete('/{code}', [SuperMagicAgentAdminApi::class, 'destroy']);
        
        // 启用Agent
        Router::put('/{code}/enable', [SuperMagicAgentAdminApi::class, 'enable']);
        
        // 禁用Agent
        Router::put('/{code}/disable', [SuperMagicAgentAdminApi::class, 'disable']);
    });
});
