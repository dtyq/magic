<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox\SuperMagicAgentSandboxApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1/sandbox-openapi', static function () {
    Router::addGroup('/agents', static function () {
        Router::get('/{code}', [SuperMagicAgentSandboxApi::class, 'show']);
        Router::post('/tool-execute', [SuperMagicAgentSandboxApi::class, 'executeTool']);
    });
});
