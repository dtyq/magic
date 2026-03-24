<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Middleware\Auth\ApiKeyMiddleware;
use App\Interfaces\Middleware\Auth\SandboxUserAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox\SkillSandboxApi;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Sandbox\SuperMagicAgentSandboxApi;
use Dtyq\SuperMagic\Interfaces\Share\Facade\ShareApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\InternalApi\FileApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenMessageScheduleApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenProjectApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenTaskApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenWorkspaceApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\SandboxApi;
use Hyperf\HttpServer\Router\Router;

// 沙箱开放接口 命名不规范，需要废弃
Router::addGroup(
    '/api/v1/sandbox-openapi',
    static function () {
        Router::addGroup('/agents', static function () {
            Router::get('/{code}', [SuperMagicAgentSandboxApi::class, 'show']);
            Router::post('/tool-execute', [SuperMagicAgentSandboxApi::class, 'executeTool']);
        });
    },
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);

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
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);

// 沙箱内部API路由分组 - 专门给沙箱调用超级麦吉使用
Router::addGroup(
    '/api/v1/open-api/sandbox',
    static function () {
        // 文件管理相关
        Router::addGroup('/file', static function () {
            // 创建文件版本
            Router::post('/versions', [FileApi::class, 'createFileVersion']);
            // 获取文件树
            Router::post('/tree', [FileApi::class, 'getFileTree']);
        });

        // 分享管理相关
        Router::addGroup('/share/resources', static function () {
            // 生成资源 ID（文件集/单文件分享的前置步骤）
            Router::post('/id', [ShareApi::class, 'generateResourceId']);
            // 创建或更新分享
            Router::post('/create', [ShareApi::class, 'createShare']);
            // 查找相似分享（避免重复创建）
            Router::post('/find-similar', [ShareApi::class, 'findSimilarShare']);
            // 取消分享
            Router::post('/{id}/cancel', [ShareApi::class, 'cancelShareByResourceId']);
        });
    },
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);

// 沙箱开放接口
Router::addGroup(
    '/api/v1/open-api/sandbox',
    static function () {
        Router::addGroup('/agents', static function () {
            Router::post('/tool-execute', [SuperMagicAgentSandboxApi::class, 'executeTool']);
            Router::get('/{code}/latest-version', [SuperMagicAgentSandboxApi::class, 'showLatestVersion']);
            Router::get('/{code}', [SuperMagicAgentSandboxApi::class, 'show']);
            Router::put('/{code}', [SuperMagicAgentSandboxApi::class, 'update']);
            Router::put('/{code}/updated-at', [SuperMagicAgentSandboxApi::class, 'touchUpdatedAt']);
            Router::post('/{code}/skills', [SuperMagicAgentSandboxApi::class, 'addAgentSkills']);
            Router::delete('/{code}/skills', [SuperMagicAgentSandboxApi::class, 'removeAgentSkills']);
        });

        // 技能相关
        Router::addGroup('/skills', static function () {
            // 获取用户技能列表
            Router::post('/queries', [SkillSandboxApi::class, 'queries']);
            // 批量查询当前用户技能的最新已发布当前版本
            Router::post('/last-versions/queries', [SkillSandboxApi::class, 'queryLatestPublishedVersions']);
            // 批量获取技能 file_key 及下载 URL（仅返回当前用户自己的技能）
            Router::post('/file-urls', [SkillSandboxApi::class, 'getSkillFileUrls']);
            // Agent 第三方导入技能
            Router::post('/import-from-agent', [SkillSandboxApi::class, 'importSkillFromAgent']);
        });

        // 市场技能库相关
        Router::addGroup('/skill-market', static function () {
            // 获取市场技能库列表
            Router::post('/queries', [SkillSandboxApi::class, 'queriesMarket']);
        });
    },
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);

// super-magic 开放api , 注意，后续的开放api均使用super-magic 不使用super-agent
Router::addGroup(
    '/api/v1/open-api/super-magic',
    static function () {
        Router::post('/sandbox/init', [SandboxApi::class, 'initSandboxByApiKey']);
        // 创建agent任务
        Router::post('/agent-task', [OpenTaskApi::class, 'agentTask']);
        // 执行脚本任务, 暂时不支持
        // Router::post('/script-task', [OpenTaskApi::class, 'scriptTask']);

        // 更新任务状态
        Router::put('/task/status', [OpenTaskApi::class, 'updateTaskStatus']);

        //  获取任务
        Router::get('/task', [OpenTaskApi::class, 'getTask']);

        // 任务相关
        Router::addGroup('/task', static function () {
            // 获取任务下的附件列表
            Router::get('/attachments', [OpenTaskApi::class, 'getOpenApiTaskAttachments']);
            // 获取任务状态（轻量级查询，用于轮询）
            Router::get('/status', [OpenTaskApi::class, 'getTaskStatus']);
            // 创建任务（支持富文本）
            Router::post('/create', [OpenTaskApi::class, 'createTask']);
            // 取消任务
            Router::post('/{id}/cancel', [OpenTaskApi::class, 'cancelTask']);
            // 创建任务分享（仅限已完成的任务）
            Router::post('/share', [OpenTaskApi::class, 'createTaskShare']);
        });

        // 工作区相关
        Router::addGroup('/workspace', static function () {
            // 获取工作区列表
            Router::get('/list', [OpenWorkspaceApi::class, 'getWorkspaceList']);
        });

        // 项目相关
        Router::addGroup('/project', static function () {
            // 创建项目
            Router::post('', [OpenProjectApi::class, 'createProject']);
        });

        // 消息定时任务
        Router::addGroup('/message-schedule', static function () {
            Router::post('', [OpenMessageScheduleApi::class, 'createMessageSchedule']);
            Router::get('/queries', [OpenMessageScheduleApi::class, 'queryMessageSchedules']);
            Router::put('/{id}', [OpenMessageScheduleApi::class, 'updateMessageSchedule']);
            Router::get('/{id}', [OpenMessageScheduleApi::class, 'getMessageScheduleDetail']);
            Router::delete('/{id}', [OpenMessageScheduleApi::class, 'deleteMessageSchedule']);
        });
    },
    ['middleware' => [ApiKeyMiddleware::class]]
);

// 无登录态校验
Router::addGroup(
    '/api/v1/open-api/super-magic',
    static function () {
        // 项目相关 - 公开接口
        Router::addGroup('/projects', static function () {
            // 获取项目基本信息（项目名称等）- 无需登录
            Router::get('/{id}', [OpenProjectApi::class, 'show']);
        });
    },
);
