<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

return [
    // JSON-RPC 客户端配置（PHP 连接到 Go UDS 服务器）
    'rpc_client_enabled' => env('IPC_RPC_CLIENT_ENABLED', true),

    // Go Engine Socket 路径（PHP 连接到这个 socket）
    'socket_path' => env('IPC_ENGINE_SOCKET', BASE_PATH . '/runtime/magic_engine.sock'),

    // 协议与安全
    'protocol_version' => (int) env('IPC_PROTOCOL_VERSION', 1),
    'auth_token' => (string) env('IPC_AUTH_TOKEN', ''),
    'client_id' => env('IPC_CLIENT_ID', ''),

    // 消息与超时
    'max_message_bytes' => (int) env('IPC_MAX_MESSAGE_BYTES', 10 * 1024 * 1024),
    'read_timeout' => (float) env('IPC_READ_TIMEOUT', 30),
    'write_timeout' => (float) env('IPC_WRITE_TIMEOUT', 10),
    'heartbeat_interval' => (float) env('IPC_HEARTBEAT_INTERVAL', 10),
    'heartbeat_timeout' => (float) env('IPC_HEARTBEAT_TIMEOUT', 30),
    'max_pending_requests' => (int) env('IPC_MAX_PENDING_REQUESTS', 1024),
    'discard_cap_multiplier' => (int) env('IPC_DISCARD_CAP_MULTIPLIER', 4),
    'discard_chunk_size' => (int) env('IPC_DISCARD_CHUNK_SIZE', 32768),
    'discard_timeout' => (float) env('IPC_DISCARD_TIMEOUT', 0),
    'oversize_max_burst' => (int) env('IPC_OVERSIZE_MAX_BURST', 3),

    // RPC 连接重试配置
    // 当前默认策略：固定间隔重连（每 1 秒一次）
    // - retries: 同步连接阶段最多尝试次数（ensureConnected/connectWithRetry）
    // - backoff_ms: 初始等待间隔（毫秒）
    // - max_backoff_ms: 最大等待间隔（毫秒）
    // - jitter_min/max: 抖动因子；固定间隔时建议都设为 1
    // - retry_log_interval_seconds: 重试日志限频窗口（秒），0 表示不限频
    // 如果要改回指数退避，可设置：
    // - backoff_ms < max_backoff_ms
    // - jitter_min/jitter_max 为非 1 的区间（例如 0.8~1.2）
    'rpc_connect_retries' => (int) env('IPC_RPC_CONNECT_RETRIES', 5),
    'rpc_connect_backoff_ms' => (int) env('IPC_RPC_CONNECT_BACKOFF_MS', 1000),
    'rpc_connect_max_backoff_ms' => (int) env('IPC_RPC_CONNECT_MAX_BACKOFF_MS', 1000),
    'rpc_retry_jitter_min' => (float) env('IPC_RPC_RETRY_JITTER_MIN', 1.0),
    'rpc_retry_jitter_max' => (float) env('IPC_RPC_RETRY_JITTER_MAX', 1.0),
    'rpc_retry_log_interval_seconds' => (int) env('IPC_RPC_RETRY_LOG_INTERVAL_SECONDS', 30),

    // /heartbeat 启动宽限期（秒）
    'heartbeat_startup_grace_seconds' => (int) env('IPC_HEARTBEAT_STARTUP_GRACE_SECONDS', 45),

    // Go Engine 自动启动配置（由 PHP 启动阶段触发）
    'engine_auto_start' => (bool) env('IPC_ENGINE_AUTO_START', true),
    'engine_start_command' => (string) env('IPC_ENGINE_START_COMMAND', 'CONFIG_FILE=./magic-go-engine-config.yaml ./bin/magic-go-engine'),
    'engine_workdir' => (string) env('IPC_ENGINE_WORKDIR', BASE_PATH),
    'engine_start_wait_timeout_seconds' => (int) env('IPC_ENGINE_START_WAIT_TIMEOUT_SECONDS', 20),
    'engine_start_wait_interval_ms' => (int) env('IPC_ENGINE_START_WAIT_INTERVAL_MS', 200),
];
