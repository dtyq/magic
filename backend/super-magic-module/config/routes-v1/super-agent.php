<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\RequestContextMiddlewareV2;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AccountApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\ProjectApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\TaskApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\TopicApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\WorkspaceApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\SandboxApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup(
    '/api/v1/super-agent',
    static function () {
        // 工作区管理
        Router::addGroup('/workspaces', static function () {
            // 获取工作区列表
            Router::get('/queries', [WorkspaceApi::class, 'getWorkspaceList']);
            // 获取工作区详情
            Router::get('/{id}', [WorkspaceApi::class, 'getWorkspaceDetail']);
            // 获取工作区下的话题列表（优化时再实现）
            Router::post('/{id}/topics', [WorkspaceApi::class, 'getWorkspaceTopics']);
            // 创建工作区
            Router::post('', [WorkspaceApi::class, 'createWorkspace']);
            // 更新工作区
            Router::put('/{id}', [WorkspaceApi::class, 'updateWorkspace']);
            // 删除工作区（逻辑删除）
            Router::delete('/{id}', [WorkspaceApi::class, 'deleteWorkspace']);
            // 设置工作区归档状态
            Router::post('/set-archived', [WorkspaceApi::class, 'setArchived']);
        });

        // 项目管理
        Router::addGroup('/projects', static function () {
            // 获取项目列表
            Router::get('/queries', [ProjectApi::class, 'index']);
            // 获取项目详情
            Router::get('/{id}', [ProjectApi::class, 'show']);
            // 创建项目
            Router::post('', [ProjectApi::class, 'store']);
            // 更新项目
            Router::put('/{id}', [ProjectApi::class, 'update']);
            // 删除项目
            Router::delete('/{id}', [ProjectApi::class, 'destroy']);
            // 获取项目下的话题列表
            Router::get('/{id}/topics', [ProjectApi::class, 'getTopics']);
            // 检查是否需要更新项目文件列表
            Router::get('/{id}/last-file-updated-time', [ProjectApi::class, 'checkFileListUpdate']);
        });

        // 话题相关
        Router::addGroup('/topics', static function () {
            // 获取话题详情
            Router::get('/{id}', [TopicApi::class, 'getTopic']);
            // 通过话题ID获取消息列表
            Router::post('/{id}/messages', [TopicApi::class, 'getMessagesByTopicId']);
            // 创建话题
            Router::post('', [TopicApi::class, 'createTopic']);
            // 更新话题
            Router::put('/{id}', [TopicApi::class, 'updateTopic']);
            // 删除话题
            Router::post('/delete', [TopicApi::class, 'deleteTopic']);
            // 智能重命名话题
            Router::post('/rename', [TopicApi::class, 'renameTopic']);
        });

        // 任务相关
        Router::addGroup('/tasks', static function () {
            // 获取任务下的附件列表
            Router::get('/{id}/attachments', [TaskApi::class, 'getTaskAttachments']);
        });

        // 账号相关
        Router::addGroup('/accounts', static function () {
            // 初始化超级麦吉账号
            Router::post('/init', [AccountApi::class, 'initAccount']);
        });

        Router::addGroup('/file', static function () {
            // 保存文件内容
            Router::post('/save', [FileApi::class, 'saveFileContent']);
            // 获取项目文件上传STS Token
            Router::post('/project-upload-token', [FileApi::class, 'getProjectUploadToken']);
            // 保存项目文件
            Router::post('/project/save', [FileApi::class, 'saveProjectFile']);
            // 批量下载相关
            Router::addGroup('/batch-download', static function () {
                // 创建批量下载任务
                Router::post('/create', [FileApi::class, 'createBatchDownload']);
                // 检查批量下载状态
                Router::get('/check', [FileApi::class, 'checkBatchDownload']);
            });
        });
    },
    ['middleware' => [RequestContextMiddlewareV2::class]]
);

// 既支持登录和非登录的接口类型（兼容前端组件）
Router::addGroup('/api/v1/super-agent', static function () {
    // 获取话题的附件列表
    Router::addGroup('/topics', static function () {
        Router::post('/{id}/attachments', [TopicApi::class, 'getTopicAttachments']);
    });

    // 获取项目的附件列表
    Router::addGroup('/projects', static function () {
        Router::post('/{id}/attachments', [ProjectApi::class, 'getProjectAttachments']);
    });

    // 获取任务附件
    Router::post('/tasks/get-file-url', [TaskApi::class, 'getFileUrls']);
    // 投递消息
    Router::post('/tasks/deliver-message', [TaskApi::class, 'deliverMessage']);

    // 更新任务状态
    Router::put('/task/status', [TaskApi::class, 'updateTaskStatus']);
    // 文件相关
    Router::addGroup('/file', static function () {
        // 刷新 STS Token (提供 super - magic 使用， 通过 metadata 换取目录信息)
        Router::post('/refresh-sts-token', [FileApi::class, 'refreshStsToken']);
        // 批量处理附件
        Router::post('/process-attachments', [FileApi::class, 'processAttachments']);
        // 新增话题附件列表(git 管理)
        Router::post('/workspace-attachments', [FileApi::class, 'workspaceAttachments']);

        // 获取文件版本列表
        Router::post('/versions', [FileApi::class, 'getFileVersions']);
        // 获取文件版本内容
        Router::post('/version/content', [FileApi::class, 'getFileVersionContent']);
    });
});



// super-magic 开放api , 注意，后续的api均使用super-magic 不使用super-agent
Router::addGroup('/api/v1/open-api/super-maigc', static function () {

    Router::post('/sandbox/init', [SandboxApi::class, 'initSandbox']);
    // 创建agent任务
    Router::post('/agent-task', [TaskApi::class, 'agentTask']);
    // 执行脚本任务
    Router::post('/script-task', [TaskApi::class, 'scriptTask']);


    // 获取任务
    Router::get('/task/{id}', [TaskApi::class, 'getOpenApiTask']);
    // 获取任务列表
    Router::get('/tasks', [TaskApi::class, 'getOpenApiTaskList']);

       // 任务相关
   Router::addGroup('/task', static function () {
        // 获取任务下的附件列表
        Router::get('/{id}/attachments', [TaskApi::class, 'getOpenApiTaskAttachments']);
    });
});
