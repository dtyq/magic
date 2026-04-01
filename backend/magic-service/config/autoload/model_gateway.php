<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'video_queue' => [
        'max_concurrency' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_MAX_CONCURRENCY', 1),
        'max_waiting' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_MAX_WAITING', 500),
        'max_pending_per_user' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_MAX_PENDING_PER_USER', 2),
        'operation_ttl_seconds' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_OPERATION_TTL_SECONDS', 72 * 3600),
        'lock_expire_seconds' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_LOCK_EXPIRE_SECONDS', 30),
        'poll_interval_seconds' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_POLL_INTERVAL_SECONDS', 3),
        'poll_max_times' => (int) env('MODEL_GATEWAY_VIDEO_QUEUE_POLL_MAX_TIMES', 200),
    ],
    'video_providers' => parse_json_config(env('MODEL_GATEWAY_VIDEO_PROVIDERS', '[]')) ?: [],
];
