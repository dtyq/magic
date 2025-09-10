<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\RequestContextMiddlewareV2;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AccountApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileEditingApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\MessageApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenProjectApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi\OpenTaskApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\ProjectApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\ProjectMemberApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\SandboxApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\SuperAgentMemoryApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\TaskApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\TopicApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\WorkspaceApi;
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
            // 获取用户参与的项目列表（支持协作项目过滤）
            Router::post('/participated', [ProjectApi::class, 'getParticipatedProjects']);
            // 获取项目详情
            Router::get('/{id}', [ProjectApi::class, 'show']);
            // 创建项目
            Router::post('', [ProjectApi::class, 'store']);
            // 更新项目
            Router::put('/{id}', [ProjectApi::class, 'update']);
            // 删除项目
            Router::delete('/{id}', [ProjectApi::class, 'destroy']);
            // 设置项目快捷方式
            Router::post('/{id}/shortcut', [ProjectApi::class, 'setProjectShortcut']);
            // 取消项目快捷方式
            Router::delete('/{id}/shortcut', [ProjectApi::class, 'cancelProjectShortcut']);
            // 获取项目下的话题列表
            Router::get('/{id}/topics', [ProjectApi::class, 'getTopics']);
            // 检查是否需要更新项目文件列表
            Router::get('/{id}/last-file-updated-time', [ProjectApi::class, 'checkFileListUpdate']);
            // 获取附件列表
            Router::get('/{id}/cloud-files', [ProjectApi::class, 'getCloudFiles']);
            // 复制项目
            Router::post('/fork', [ProjectApi::class, 'fork']);
            // 查询复制状态
            Router::get('/{id}/fork-status', [ProjectApi::class, 'forkStatus']);
            // 移动项目到另一个工作区
            Router::post('/move', [ProjectApi::class, 'moveProject']);
            // 获取项目协作成员
            Router::get('/{id}/members', [ProjectMemberApi::class, 'getMembers']);
            // 更新项目协作成员
            Router::put('/{id}/members', [ProjectMemberApi::class, 'updateMembers']);
        });
        // 协作项目相关路由分组
        Router::addGroup('/collaboration-projects', static function () {
            // 获取协作项目列表
            Router::get('', [ProjectMemberApi::class, 'getCollaborationProjects']);
            // 获取协作项目创建者列表
            Router::get('/creators', [ProjectMemberApi::class, 'getCollaborationProjectCreators']);
            // 更新项目置顶状态
            Router::put('/{id}/pin', [ProjectMemberApi::class, 'updateProjectPin']);
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

        // 消息队列管理
        Router::addGroup('/message-queue', static function () {
            // 创建消息队列
            Router::post('', [MessageApi::class, 'createMessageQueue']);
            // 修改消息队列
            Router::put('/{id}', [MessageApi::class, 'updateMessageQueue']);
            // 删除消息队列
            Router::delete('/{id}', [MessageApi::class, 'deleteMessageQueue']);
            // 查询消息队列
            Router::post('/queries', [MessageApi::class, 'queryMessageQueues']);
            // 消费消息
            Router::post('/{id}/consume', [MessageApi::class, 'consumeMessageQueue']);
        });

        Router::addGroup('/file', static function () {
            // 获取项目文件上传STS Token
            Router::get('/project-upload-token', [FileApi::class, 'getProjectUploadToken']);
            // 获取话题文件上传STS Token
            Router::get('/topic-upload-token', [FileApi::class, 'getTopicUploadToken']);
            // 创建文件和文件夹
            Router::post('', [FileApi::class, 'createFile']);
            // 保存附件关系
            Router::post('/project/save', [FileApi::class, 'saveProjectFile']);
            // 批量保存附件关系
            Router::post('/project/batch-save', [FileApi::class, 'batchSaveProjectFiles']);
            // 保存文件内容
            Router::post('/save', [FileApi::class, 'saveFileContent']);
            // 删除附件
            Router::delete('/{id}', [FileApi::class, 'deleteFile']);
            // 删除目录及其下所有文件
            Router::post('/directory/delete', [FileApi::class, 'deleteDirectory']);
            // 重命名文件
            Router::post('/{id}/rename', [FileApi::class, 'renameFile']);
            // 移动文件
            Router::post('/{id}/move', [FileApi::class, 'moveFile']);
            // 批量移动文件
            Router::post('/batch-move', [FileApi::class, 'batchMoveFile']);
            // 批量删除文件
            Router::post('/batch-delete', [FileApi::class, 'batchDeleteFiles']);

            // 批量下载相关
            Router::addGroup('/batch-download', static function () {
                // 创建批量下载任务
                Router::post('/create', [FileApi::class, 'createBatchDownload']);
                // 检查批量下载状态
                Router::get('/check', [FileApi::class, 'checkBatchDownload']);
            });

            // 批量操作状态查询
            Router::addGroup('/batch-operation', static function () {
                // 检查批量操作状态
                Router::get('/check', [FileApi::class, 'checkBatchOperationStatus']);
            });

            // 文件编辑状态管理
            // 加入编辑
            Router::post('/{fileId}/join-editing', [FileEditingApi::class, 'joinEditing']);
            // 离开编辑
            Router::post('/{fileId}/leave-editing', [FileEditingApi::class, 'leaveEditing']);
            // 获取编辑用户数量
            Router::get('/{fileId}/editing-users', [FileEditingApi::class, 'getEditingUsers']);
        });

        Router::addGroup('/sandbox', static function () {
            // 初始化沙盒
            Router::post('/init', [SandboxApi::class, 'initSandboxByAuthorization']);
            // 获取沙盒状态
            Router::get('/status', [SandboxApi::class, 'getSandboxStatus']);
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

    // 获取任务附件 （需要替换一下这个名称）
    Router::post('/tasks/get-file-url', [FileApi::class, 'getFileUrls']);
    // 投递消息
    Router::post('/tasks/deliver-message', [TaskApi::class, 'deliverMessage']);

    // 文件转换相关
    Router::addGroup('/file-convert', static function () {
        // 创建文件转换任务
        Router::post('/create', [TaskApi::class, 'convertFiles']);
        // 检查文件转换状态
        Router::get('/check', [TaskApi::class, 'checkFileConvertStatus']);
    });

    // 长期记忆管理（沙箱token验证已移到API层内部）
    Router::addGroup('/memories', static function () {
        Router::post('', [SuperAgentMemoryApi::class, 'createMemory']);
        Router::put('/{id}', [SuperAgentMemoryApi::class, 'agentUpdateMemory']);
        Router::delete('/{id}', [SuperAgentMemoryApi::class, 'deleteMemory']);
    });
    // 文件相关
    Router::addGroup('/file', static function () {
        // 沙盒文件变更通知
        Router::post('/sandbox/notifications', [FileApi::class, 'handleSandboxNotification']);
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
        // 根据文件id获取文件名称
        Router::get('/{id}/file-name', [FileApi::class, 'getFileByName']);
        // 批量获取下载链接
        // Router::post('/batch-urls', [FileApi::class, 'getFileUrls']);
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
