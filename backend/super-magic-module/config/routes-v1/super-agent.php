<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AccountApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\ConfigApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\FileApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\WorkspaceApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\TopicApi;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\TaskApi;
use Hyperf\HttpServer\Router\Router;
use Dtyq\SuperMagic\Infrastructure\Utils\Middleware\RequestContextMiddlewareV2;

Router::addGroup('/api/v1/super-agent', static function () {
    // 工作区管理
    Router::addGroup('/workspaces', static function () {
        // 获取工作区列表
        Router::post('/queries', [WorkspaceApi::class, 'getWorkspaceList']);
        // 获取工作区下的话题列表（优化时再实现）
        Router::post('/{id}/topics', [WorkspaceApi::class, 'getWorkspaceTopics']);
        // 保存工作区（创建或更新）
        Router::post('/save', [WorkspaceApi::class, 'saveWorkspace']);
        // 删除工作区（逻辑删除）
        Router::post('/delete', [WorkspaceApi::class, 'deleteWorkspace']);
        // 设置工作区归档状态
        Router::post('/set-archived', [WorkspaceApi::class, 'setArchived']);
    });

    // 话题相关
    Router::addGroup('/topics', static function () {
        // 获取话题详情
        Router::get('/{id}', [TopicApi::class, 'getTopic']);
        // 通过话题ID获取消息列表
        Router::post('/{id}/messages', [TopicApi::class, 'getMessagesByTopicId']);
        // 保存话题
        Router::post('/save', [TopicApi::class, 'saveTopic']);
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

    // 配置相关
    Router::addGroup('/config', static function () {
        // 检查是否应该重定向到SuperMagic
        Router::get('/should-redirect', [ConfigApi::class, 'shouldRedirectToSuperMagic']);
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
    
    // 获取任务附件
    Router::post('/tasks/get-file-url', [TaskApi::class, 'getFileUrls']);
    // 投递消息
    Router::post('/tasks/deliver-message', [TaskApi::class, 'deliverMessage']);

    // 文件相关
    Router::addGroup('/file', static function () {
        // 刷新 STS Token (提供 super - magic 使用， 通过 metadata 换取目录信息)
        Router::post('/refresh-sts-token', [FileApi::class, 'refreshStsToken']);
        // 批量处理附件
        Router::post('/process-attachments', [FileApi::class, 'processAttachments']);
    });
});

