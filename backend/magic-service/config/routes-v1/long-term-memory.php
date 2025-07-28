<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\LongTermMemory\Facade\LongTermMemoryHttpApi;
use Hyperf\HttpServer\Router\Router;

// 长期记忆API路由
Router::addGroup('/api/v1/memories', static function () {
    // 静态路由应在动态路由之前定义以避免冲突

    // 基础操作
    Router::get('', [LongTermMemoryHttpApi::class, 'getMemoryList']);
    Router::post('', [LongTermMemoryHttpApi::class, 'createMemory']);

    // 记忆搜索
    Router::get('/search', [LongTermMemoryHttpApi::class, 'searchMemories']);

    // 批量记忆强化
    Router::post('/reinforce', [LongTermMemoryHttpApi::class, 'reinforceMemories']);

    // 批量接受记忆建议
    Router::post('/accept', [LongTermMemoryHttpApi::class, 'acceptMemorySuggestions']);

    // 记忆维护
    Router::post('/maintain', [LongTermMemoryHttpApi::class, 'maintainMemories']);

    // 记忆统计信息
    Router::get('/stats', [LongTermMemoryHttpApi::class, 'getMemoryStats']);

    // 系统提示词
    Router::get('/prompt', [LongTermMemoryHttpApi::class, 'getMemoryPrompt']);

    // 评估对话内容并可能创建记忆
    Router::post('/evaluate', [LongTermMemoryHttpApi::class, 'evaluateConversation']);

    // -- 动态路由 --

    // 单个记忆的CRUD操作
    Router::get('/{memoryId}', [LongTermMemoryHttpApi::class, 'getMemory']);
    Router::put('/{memoryId}', [LongTermMemoryHttpApi::class, 'updateMemory']);
    Router::delete('/{memoryId}', [LongTermMemoryHttpApi::class, 'deleteMemory']);

    // 单个记忆强化
    Router::post('/{memoryId}/reinforce', [LongTermMemoryHttpApi::class, 'reinforceMemory']);
}, ['middleware' => [RequestContextMiddleware::class]]);
