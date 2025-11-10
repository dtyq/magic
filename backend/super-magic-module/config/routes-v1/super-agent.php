<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\RequestContextMiddlewareV2;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AccountApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileEditingApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileKeyCleanupApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\MessageApi;
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
            // 置顶项目
            Router::put('/{id}/pin', [ProjectApi::class, 'pin']);
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
            Router::put('/{project_id}/pin', [ProjectMemberApi::class, 'updateProjectPin']);
            // 更新项目快捷方式状态
            Router::put('/{project_id}/shortcut', [ProjectMemberApi::class, 'updateProjectShortcut']);
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
            // Checkpoint 回滚管理
            Router::addGroup('/{id}/checkpoints', static function () {
                // 直接回滚检查点
                Router::post('/rollback', [TopicApi::class, 'rollbackCheckpoint']);

                Router::addGroup('/rollback', static function () {
                    // 检查回滚检查点的可行性
                    Router::post('/check', [TopicApi::class, 'rollbackCheckpointCheck']);
                    // 开始回滚检查点（标记状态而非删除）
                    Router::post('/start', [TopicApi::class, 'rollbackCheckpointStart']);
                    // 提交回滚检查点（物理删除撤回状态的消息）
                    Router::post('/commit', [TopicApi::class, 'rollbackCheckpointCommit']);
                    // 撤销回滚检查点（将撤回状态的消息恢复为正常状态）
                    Router::post('/undo', [TopicApi::class, 'rollbackCheckpointUndo']);
                });
            });
            // 复制话题消息
            Router::addGroup('/{id}/duplicate-chat', static function () {
                // 复制话题消息（同步）
                Router::post('', [TopicApi::class, 'duplicateChat']);
                // 复制话题消息（异步）
                Router::post('/create-job', [TopicApi::class, 'duplicateChatAsync']);
                // 检查复制话题消息是否成功
                Router::post('/check', [TopicApi::class, 'duplicateChatCheck']);
            });
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

        // 消息定时任务
        Router::addGroup('/message-schedule', static function () {
            // 创建定时任务
            Router::post('', [MessageApi::class, 'createMessageSchedule']);
            // 修改定时任务
            Router::put('/{id}', [MessageApi::class, 'updateMessageSchedule']);
            // 删除定时任务
            Router::delete('/{id}', [MessageApi::class, 'deleteMessageSchedule']);
            // 查询定时任务
            Router::post('/queries', [MessageApi::class, 'queryMessageSchedules']);
            // 查询定时任务详情
            Router::get('/{id}', [MessageApi::class, 'getMessageScheduleDetail']);
            // 查询定时任务执行日志
            Router::post('/{id}/logs', [MessageApi::class, 'getMessageScheduleLogs']);
            // 手动执行定时任务（测试用途）
            Router::post('/{id}/execute', [MessageApi::class, 'executeMessageScheduleForTest']);
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
            // 获取文件版本列表
            Router::get('/{id}/versions', [FileApi::class, 'getFileVersions']);
            // 文件回滚到指定版本
            Router::post('/{id}/rollback', [FileApi::class, 'rollbackFileToVersion']);
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
            // 升级沙箱镜像
            Router::put('/upgrade', [SandboxApi::class, 'upgradeSandbox']);
        });

        // 文件键清理管理
        Router::addGroup('/file-keys/cleanup', static function () {
            // 获取清理统计信息
            Router::get('/statistics', [FileKeyCleanupApi::class, 'getStatistics']);
            // 执行清理
            Router::post('', [FileKeyCleanupApi::class, 'cleanup']);
            // 预览清理（dry-run模式）
            Router::post('/preview', [FileKeyCleanupApi::class, 'preview']);
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

        // 根据文件id获取文件基本信息
        Router::get('/{id}', [FileApi::class, 'getFileInfo']);
        // 根据文件id获取文件名称
        Router::get('/{id}/file-name', [FileApi::class, 'getFileByName']);
        // 批量获取下载链接
        // Router::post('/batch-urls', [FileApi::class, 'getFileUrls']);
    });
});

// V2 API Routes
Router::addGroup(
    '/api/v2/super-agent',
    static function () {
        // 获取项目的附件列表 V2 (不返回树状结构)
        Router::addGroup('/projects', static function () {
            Router::post('/{id}/attachments', [ProjectApi::class, 'getProjectAttachmentsV2']);
        });
    },
    ['middleware' => [RequestContextMiddlewareV2::class]]
);
