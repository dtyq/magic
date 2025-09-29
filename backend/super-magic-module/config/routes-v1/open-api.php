<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox\SuperMagicAgentSandboxApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\SandboxApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenTaskApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenProjectApi;
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\SandboxTokenAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi\FileApi;
use Hyperf\HttpServer\Router\Router;

// 沙箱开放接口 命名不规范，需要废弃
Router::addGroup('/api/v1/sandbox-openapi', static function () {
    Router::addGroup('/agents', static function () {
        Router::get('/{code}', [SuperMagicAgentSandboxApi::class, 'show']);
        Router::post('/tool-execute', [SuperMagicAgentSandboxApi::class, 'executeTool']);
    });
});


// 沙箱内部API路由分组 - 专门给沙箱调用超级麦吉使用，命名不规范，需要废弃
Router::addGroup(
    '/open/internal-api',
    static function () {
        // 超级助理相关
        Router::addGroup('/super-agent', static function () {
            // 文件管理相关
            Router::addGroup('/file', static function () {
                // 创建文件版本
                Router::post('/versions', [FileApi::class, 'createFileVersion']);
            });
        });
    },
    ['middleware' => [SandboxTokenAuthMiddleware::class]]
);


// 沙箱内部API路由分组 - 专门给沙箱调用超级麦吉使用
Router::addGroup(
    '/api/v1/open-api/sandbox',
    static function () {
            // 文件管理相关
            Router::addGroup('/file', static function () {
                // 创建文件版本
                Router::post('/versions', [FileApi::class, 'createFileVersion']);
            });
    },
    ['middleware' => [SandboxTokenAuthMiddleware::class]]
);



// 沙箱开放接口
Router::addGroup('/api/v1/open-api/sandbox', static function () {
    Router::addGroup('/agents', static function () {
        Router::get('/{code}', [SuperMagicAgentSandboxApi::class, 'show']);
        Router::post('/tool-execute', [SuperMagicAgentSandboxApi::class, 'executeTool']);
    });
});



// super-magic 开放api , 注意，后续的开放api均使用super-magic 不使用super-agent
Router::addGroup('/api/v1/open-api/super-magic', static function () {
    Router::post('/sandbox/init', [SandboxApi::class, 'initSandboxByApiKey']);
    // 创建agent任务
    Router::post('/agent-task', [OpenTaskApi::class, 'agentTask']);
    // 执行脚本任务
    Router::post('/script-task', [OpenTaskApi::class, 'scriptTask']);

    // 更新任务状态
    Router::put('/task/status', [OpenTaskApi::class, 'updateTaskStatus']);

    // // 获取任务
    Router::get('/task', [OpenTaskApi::class, 'getTask']);
    // // 获取任务列表
    // Router::get('/tasks', [OpenTaskApi::class, 'getOpenApiTaskList']);

    // 任务相关
    Router::addGroup('/task', static function () {
        // 获取任务下的附件列表
        Router::get('/attachments', [OpenTaskApi::class, 'getOpenApiTaskAttachments']);
    });

    // 项目相关 - 公开接口
    Router::addGroup('/projects', static function () {
        // 获取项目基本信息（项目名称等）- 无需登录
        Router::get('/{id}', [OpenProjectApi::class, 'show']);
    });
});
