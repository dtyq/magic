<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Interfaces\Contact\Facade\Open\MagicContactSandboxApi;
use App\Interfaces\MCP\Facade\OpenApi\MCPAuthorizationCredentialApi;
use App\Interfaces\Middleware\Auth\ApiKeyMiddleware;
use App\Interfaces\Middleware\Auth\SandboxUserAuthMiddleware;
use App\Interfaces\SuperMagic\Agent\Facade\OpenApi\OpenSuperMagicAgentApi;
use App\Interfaces\SuperMagic\Agent\Facade\Sandbox\SkillSandboxApi;
use App\Interfaces\SuperMagic\Agent\Facade\Sandbox\SuperMagicAgentSandboxApi;
use App\Interfaces\SuperMagic\Common\Share\Facade\ShareApi;
use App\Interfaces\SuperMagic\Design\Facade\Sandbox\HtmlDesignStyleSandboxApi;
use App\Interfaces\SuperMagic\File\Facade\InternalApi\FileApi;
use App\Interfaces\SuperMagic\File\Facade\OpenApi\OpenFileApi;
use App\Interfaces\SuperMagic\Message\Facade\OpenApi\OpenMessageScheduleApi;
use App\Interfaces\SuperMagic\Project\Facade\OpenApi\OpenMicroAppApi;
use App\Interfaces\SuperMagic\Project\Facade\OpenApi\OpenProjectApi;
use App\Interfaces\SuperMagic\Task\Facade\InternalApi\AiAbilityApi;
use App\Interfaces\SuperMagic\Task\Facade\InternalApi\FollowUpSuggestionApi;
use App\Interfaces\SuperMagic\Task\Facade\InternalApi\SandboxApi as InternalSandboxApi;
use App\Interfaces\SuperMagic\Task\Facade\InternalApi\TaskApi as InternalTaskApi;
use App\Interfaces\SuperMagic\Task\Facade\OpenApi\OAuth2CallbackRelayApi;
use App\Interfaces\SuperMagic\Task\Facade\OpenApi\OAuth2CallbackRelayPublicApi;
use App\Interfaces\SuperMagic\Task\Facade\OpenApi\OpenTaskApi;
use App\Interfaces\SuperMagic\Task\Facade\SandboxApi;
use App\Interfaces\SuperMagic\Topic\Facade\OpenApi\OpenTopicApi;
use App\Interfaces\SuperMagic\Workspace\Facade\OpenApi\OpenWorkspaceApi;
use Hyperf\HttpServer\Router\Router;

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
                // 获取文件最新版本
                Router::get('/{id}/versions/latest', [FileApi::class, 'getLatestFileVersion']);
            });
        });
    },
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);

// 沙箱内部API路由分组 - 专门给沙箱调用超级麦吉使用
Router::addGroup(
    '/api/v1/open-api/sandbox',
    static function () {
        // 获取当前沙箱状态及镜像版本信息
        Router::get('/info', [InternalSandboxApi::class, 'getSandboxInfo']);
        // 无条件重启当前沙箱
        Router::put('/restart', [InternalSandboxApi::class, 'restartSandbox']);
        // 沙箱自我升级
        Router::put('/upgrade', [InternalSandboxApi::class, 'upgradeSandbox']);
        // 检查沙箱镜像版本（当前版本 vs 最新版本）
        Router::get('/version-check', [InternalSandboxApi::class, 'checkSandboxVersion']);
        Router::post('/follow-up-suggestions', [FollowUpSuggestionApi::class, 'report']);

        Router::get('/contact/users/search', [MagicContactSandboxApi::class, 'searchUsers']);
        Router::get('/contact/departments/search', [MagicContactSandboxApi::class, 'searchDepartments']);

        // 文件管理相关
        Router::addGroup('/file', static function () {
            Router::post('/upload', [OpenFileApi::class, 'uploadProjectFile']);
            Router::post('/project/batch-save', [OpenFileApi::class, 'batchSaveProjectFiles']);
            // 创建文件版本
            Router::post('/versions', [FileApi::class, 'createFileVersion']);
            // 获取文件最新版本
            Router::get('/{id}/versions/latest', [FileApi::class, 'getLatestFileVersion']);
            // 获取文件树
            Router::post('/tree', [FileApi::class, 'getFileTree']);
            // 扫描对象存储目录下的 .wav 文件并持久化到 task file 表
            Router::post('/scan-wav', [FileApi::class, 'scanWavFiles']);
            // 更新文件来源
            Router::patch('/source', [FileApi::class, 'updateFileSource']);
        });

        // 超级助理内部消息相关
        Router::addGroup('/super-agent/tasks', static function () {
            // 第三方消息入站
            Router::post('/ingest-third-party-message', [InternalTaskApi::class, 'ingestThirdPartyMessage']);
        });

        // AI 能力运行时配置
        Router::addGroup('/ai-abilities', static function () {
            Router::get('/runtime-config', [AiAbilityApi::class, 'runtimeConfig']);
        });

        // MCP Authorization 运行时凭据
        Router::get('/mcp/authorization/credential/{code}', [MCPAuthorizationCredentialApi::class, 'getCredential']);

        // 分享管理相关
        Router::addGroup('/share/resources', static function () {
            // 生成资源 ID（文件集/单文件分享的前置步骤）
            Router::post('/id', [ShareApi::class, 'generateResourceId']);
            // 创建或更新分享
            Router::post('/create', [ShareApi::class, 'createShare']);
            // 查找相似分享（避免重复创建）
            Router::post('/find-similar', [ShareApi::class, 'findSimilarShare']);
            // 获取当前用户的分享列表
            Router::post('/list', [ShareApi::class, 'getShareListByStatusFilter']);
            // 按资源 ID 获取当前用户的有效分享
            Router::get('/{id}', [ShareApi::class, 'getShareByResourceId']);
            // 取消分享
            Router::post('/{id}/cancel', [ShareApi::class, 'cancelShareByResourceId']);
        });
    },
    ['middleware' => [SandboxUserAuthMiddleware::class]]
);

// OAuth2 provider 重定向接收接口；provider 回调不携带沙箱鉴权
Router::get('/api/v1/open-api/sandbox/oauth2/callback-relay', [OAuth2CallbackRelayPublicApi::class, 'callback']);

// 沙箱开放接口
Router::addGroup(
    '/api/v1/open-api/sandbox',
    static function () {
        Router::addGroup('/agents', static function () {
            // 获取当前用户可用的员工列表
            Router::post('/me/available', [OpenSuperMagicAgentApi::class, 'getMyAvailableAgents']);
            Router::post('/tool-execute', [SuperMagicAgentSandboxApi::class, 'executeTool']);
            Router::post('/agent-execute', [SuperMagicAgentSandboxApi::class, 'executeAgent']);
            Router::get('/{code}/latest-version', [SuperMagicAgentSandboxApi::class, 'showLatestVersion']);
            Router::get('/{code}', [SuperMagicAgentSandboxApi::class, 'show']);
            Router::put('/{code}', [SuperMagicAgentSandboxApi::class, 'update']);
            Router::put('/{code}/updated-at', [SuperMagicAgentSandboxApi::class, 'touchUpdatedAt']);
            Router::post('/{code}/skills', [SuperMagicAgentSandboxApi::class, 'addAgentSkills']);
            Router::delete('/{code}/skills', [SuperMagicAgentSandboxApi::class, 'removeAgentSkills']);
        });

        Router::addGroup('/assistants', static function () {
            Router::post('/assistant-execute', [SuperMagicAgentSandboxApi::class, 'executeAssistant']);
        });

        // OAuth2 callback payload 内部操作接口
        Router::addGroup('/oauth2', static function () {
            Router::get('/callback-relay/fetch-callback', [OAuth2CallbackRelayApi::class, 'fetchCallback']);
            Router::delete('/callback-relay/delete-callback', [OAuth2CallbackRelayApi::class, 'deleteCallback']);
        });

        // 技能相关
        Router::addGroup('/skills', static function () {
            Router::post('', [SkillSandboxApi::class, 'create']);
            Router::get('/by-project/{projectId}', [SkillSandboxApi::class, 'byProject']);
            Router::get('/{code}', [SkillSandboxApi::class, 'detail']);
            Router::get('/{code}/publish/prefill', [SkillSandboxApi::class, 'prefill']);
            Router::get('/{code}/versions', [SkillSandboxApi::class, 'versions']);
            Router::post('/{code}/publish/prepare', [SkillSandboxApi::class, 'prepare']);
            Router::get('/{code}/publish/prepare/check', [SkillSandboxApi::class, 'checkPreparation']);
            Router::post('/{code}/publish', [SkillSandboxApi::class, 'publish']);
            Router::get('/{code}/publish/check', [SkillSandboxApi::class, 'checkPublish']);
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

        // HTML 设计风格源文，供 super-magic 内部 Skill 调用
        Router::addGroup('/html-design-styles', static function () {
            Router::get('/{styleCode}/source', [HtmlDesignStyleSandboxApi::class, 'getSource']);
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

        // 数字员工相关
        Router::addGroup('/agents', static function () {
            Router::get('/featured/sort-list', [OpenSuperMagicAgentApi::class, 'sortListQueries']);
            // Hire a digital employee from the market.
            Router::post('/{code}/hire', [OpenSuperMagicAgentApi::class, 'hireAgent']);
            // Fire a digital employee using the existing deletion rules.
            Router::post('/{code}/fire', [OpenSuperMagicAgentApi::class, 'fireAgent']);
            Router::get('/{code}/models', [OpenSuperMagicAgentApi::class, 'getModels']);
            Router::get('/{code}/default-config', [OpenSuperMagicAgentApi::class, 'getDefaultConfig']);
        });

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

        Router::addGroup('/file', static function () {
            // 获取项目文件上传 STS Token
            Router::get('/project-upload-token', [OpenFileApi::class, 'getProjectUploadToken']);
            // 批量获取文件 URL
            Router::post('/get-urls', [OpenFileApi::class, 'getFileUrls']);
            // 保存项目附件关系
            Router::post('/project/save', [OpenFileApi::class, 'saveProjectFile']);
        });

        // 项目相关
        Router::addGroup('/project', static function () {
            // 创建项目
            Router::post('', [OpenProjectApi::class, 'createProject']);
        });

        Router::addGroup('/projects', static function () {
            // 获取项目列表
            Router::get('/queries', [OpenProjectApi::class, 'index']);
            // 获取项目附件列表
            Router::post('/{id}/attachments', [OpenProjectApi::class, 'getProjectAttachments']);
        });

        // 话题管理
        Router::addGroup('/topics', static function () {
            // 获取话题详情
            Router::get('/{id}', [OpenTopicApi::class, 'getTopic']);
            // 创建话题
            Router::post('', [OpenTopicApi::class, 'createTopic']);
            // 更新话题
            Router::put('/{id}', [OpenTopicApi::class, 'updateTopic']);
            // 删除话题（逻辑删除）
            Router::post('/delete', [OpenTopicApi::class, 'deleteTopic']);
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

// 获取项目基本信息（公开接口，无需鉴权；放在 super-magic 鉴权分组之后，确保 /queries 静态路由先于 {id} 动态路由注册，避免 FastRoute 路由遮蔽冲突）
Router::get('/api/v1/open-api/super-magic/projects/{id}', [OpenProjectApi::class, 'show']);

// 获取已发布微应用的项目名称（公开接口，仅用于 Web Node 服务生成页面标题）
Router::get('/api/v1/open-api/super-magic/micro-apps/{appId}/title', [OpenMicroAppApi::class, 'showTitle']);
