<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Agent\Facade\MagicAgentApi;
use App\Interfaces\Agent\Facade\MagicBotThirdPlatformChatApi;
use App\Interfaces\Agent\Facade\Open\ThirdPlatformChatApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    // 助理管理
    Router::addGroup('/agents', static function () {
        // 获取助理列表
        Router::get('/queries', [MagicAgentApi::class, 'queries']);
        Router::post('/queries', [MagicAgentApi::class, 'queries']);
        // 获取可用助理
        Router::get('/available', [MagicAgentApi::class, 'queriesAvailable']);
        // 获取聊天模式可用助理列表
        Router::get('/chat-mode/available', [MagicAgentApi::class, 'getChatModeAvailableAgents']);
        // 保存助理
        Router::post('', [MagicAgentApi::class, 'saveAgent']);
        // 获取单个助理
        Router::get('/{agentId:\d+}', [MagicAgentApi::class, 'getAgentDetailByAgentId']);
        // 删除助理
        Router::delete('/{agentId}', [MagicAgentApi::class, 'deleteAgentById']);

        // 更新助理状态
        Router::put('/{agentId}/status', [MagicAgentApi::class, 'updateAgentStatus']);
        // 更新企业助理状态
        Router::put('/{agentId}/enterprise-status', [MagicAgentApi::class, 'updateAgentEnterpriseStatus']);
        // 注册助理并添加好友
        Router::post('/{agentVersionId}/register-friend', [MagicAgentApi::class, 'registerAgentAndAddFriend']);
        // 检查助理是否被更新
        Router::get('/{agentId}/is-updated', [MagicAgentApi::class, 'isUpdated']);

        // 保存指令
        Router::post('/{agentId}/instructs', [MagicAgentApi::class, 'saveInstruct']);

        // 获取最大版本
        Router::get('/{agentId}/max', [MagicAgentApi::class, 'getAgentMaxVersion']);

        // 版本管理
        Router::addGroup('/versions', static function () {
            // 获取已发布版本
            Router::get('/{agentVersionId:\d+}', [MagicAgentApi::class, 'getAgentVersionById']);
            // 获取组织的助理
            Router::get('/organization', [MagicAgentApi::class, 'getAgentsByOrganization']);
            // 获取市场助理
            Router::get('/marketplace', [MagicAgentApi::class, 'getAgentsFromMarketplace']);
            // 发布版本
            Router::post('', [MagicAgentApi::class, 'releaseAgentVersion']);
        });

        // 获取特定助理的版本列表
        Router::get('/{agentId:\d+}/versions', [MagicAgentApi::class, 'getReleaseAgentVersions']);

        // 版本操作
        Router::addGroup('/versions', static function () {
            // 根据userId获取详情
            Router::get('/{userId}/user', [MagicAgentApi::class, 'getDetailByUserId']);
        });
    });

    // 指令选项
    Router::addGroup('/agent-options', static function () {
        // 获取指令类型选项
        Router::get('/instruct-types', [MagicAgentApi::class, 'getInstructTypeOptions']);
        // 获取指令组类型选项
        Router::get('/instruct-group-types', [MagicAgentApi::class, 'getInstructGroupTypeOptions']);
        // 获取指令状态颜色选项
        Router::get('/instruct-state-colors', [MagicAgentApi::class, 'getInstructionStateColorOptions']);
        // 获取指令图标颜色选项
        Router::get('/instruct-state-icons', [MagicAgentApi::class, 'getInstructionIconColorOptions']);
        // 获取系统指令类型选项
        Router::get('/instruct-system', [MagicAgentApi::class, 'getSystemInstructTypeOptions']);
    });

    // 第三方机器人-聊天管理
    Router::addGroup('/agents/third-platform', function () {
        // 保存
        Router::post('/', [MagicBotThirdPlatformChatApi::class, 'save']);
        // 查询
        Router::post('/{botId}/queries', [MagicBotThirdPlatformChatApi::class, 'queries']);
        // 获取列表
        Router::get('/{botId}/list', [MagicBotThirdPlatformChatApi::class, 'listByBotId']);
        // 删除
        Router::delete('/{id}', [MagicBotThirdPlatformChatApi::class, 'destroy']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);

// 第三方机器人-聊天接入
Router::addGroup('/api/v1/bot/third-platform', function () {
    // 聊天
    Router::addRoute(['GET', 'POST'], '/chat', [ThirdPlatformChatApi::class, 'chat']);
});
