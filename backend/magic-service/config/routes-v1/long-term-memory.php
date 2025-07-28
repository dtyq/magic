<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\LongTermMemory\Facade\LongTermMemoryAdminApi;
use Hyperf\HttpServer\Router\Router;

// 长期记忆集合操作API路由
Router::addGroup('/api/v1/memories', static function () {
    // 基础操作
    Router::post('/queries', [LongTermMemoryAdminApi::class, 'getMemoryList']);

    // 批量处理记忆建议（接受/拒绝）
    Router::put('/status', [LongTermMemoryAdminApi::class, 'batchProcessMemorySuggestions']);

    // 批量更新记忆启用状态（启用/禁用）
    Router::put('/enabled', [LongTermMemoryAdminApi::class, 'batchUpdateMemoryStatus']);

    // 记忆统计信息
    Router::get('/stats', [LongTermMemoryAdminApi::class, 'getMemoryStats']);

    // 系统提示词
    Router::get('/prompt', [LongTermMemoryAdminApi::class, 'getMemoryPrompt']);

    // 评估对话内容并可能创建记忆
    Router::post('/evaluate', [LongTermMemoryAdminApi::class, 'evaluateConversation']);
}, ['middleware' => [RequestContextMiddleware::class]]);

// 单个记忆操作API路由
Router::addGroup('/api/v1/memory', static function () {
    // 基础CRUD操作
    Router::get('/{memoryId}', [LongTermMemoryAdminApi::class, 'getMemory']);
    Router::put('/{memoryId}', [LongTermMemoryAdminApi::class, 'updateMemory']);
    Router::delete('/{memoryId}', [LongTermMemoryAdminApi::class, 'deleteMemory']);
    Router::post('', [LongTermMemoryAdminApi::class, 'createMemory']);
    // 记忆强化
    Router::post('/{memoryId}/reinforce', [LongTermMemoryAdminApi::class, 'reinforceMemory']);
}, ['middleware' => [RequestContextMiddleware::class]]);
