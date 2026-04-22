<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 视频任务队列、直提 provider 并发控制和轮询相关配置。
    'video_queue' => [
        // 本地视频队列 worker 同时运行的视频任务上限。
        'max_concurrency' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_MAX_CONCURRENCY', 1),
        // 本地视频队列允许等待的最大任务数，超过后拒绝入队。
        'max_waiting' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_MAX_WAITING', 500),
        // 同一用户在本地视频队列中允许等待的最大任务数。
        'max_pending_per_user' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_MAX_PENDING_PER_USER', 2),
        'operation_ttl_seconds' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_OPERATION_TTL_SECONDS', 72 * 3600),
        // 视频队列调度和状态迁移使用的 Redis 锁过期时间。
        'lock_expire_seconds' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_LOCK_EXPIRE_SECONDS', 30),
        // 视频队列 worker 查询 provider 任务状态的轮询间隔。
        'poll_interval_seconds' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_POLL_INTERVAL_SECONDS', 3),
        // 视频队列 worker 查询 provider 任务状态的最大轮询次数。
        'poll_max_times' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_POLL_MAX_TIMES', 200),

        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // 并发限制
        // 同一组织下同一 user_id 允许同时运行的视频任务数，默认每人 1 个。
        'default_user_active_operation_limit' => (int) env('MODEL_GATEWAY_VIDEO_USER_CONCURRENCY_LIMIT', 1),
        // 按组织 code 覆盖个人视频并发上限，格式示例：{"org-a":2,"org-b":3}。
        'user_active_operation_limit_overrides' => parse_json_config(env('MODEL_GATEWAY_VIDEO_USER_CONCURRENCY_LIMITS', '[]')) ?: [],
        // 同一组织下所有用户合计允许同时运行的视频任务数，0 表示不限制。
        'default_organization_active_operation_limit' => (int) env('MODEL_GATEWAY_VIDEO_ORGANIZATION_CONCURRENCY_LIMIT', 0),
        // 按组织 code 覆盖组织视频总并发上限，格式示例：{"org-a":10,"org-b":20}。
        'organization_active_operation_limit_overrides' => parse_json_config(env('MODEL_GATEWAY_VIDEO_ORGANIZATION_CONCURRENCY_LIMITS', '[]')) ?: [],
        // 视频任务实体和运行槽位在 Redis 中的保留时间。
    ],
    // 视频 provider 运行时配置列表，包含 provider、模型、鉴权和网关地址等信息。
    'video_providers' => parse_json_config(env('MODEL_GATEWAY_VIDEO_PROVIDERS', '[]')) ?: [],
];
