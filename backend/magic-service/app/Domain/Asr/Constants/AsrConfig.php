<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Constants;

/**
 * ASR 配置常量
 * 统一管理 ASR 相关的所有配置常量，包括超时时间、轮询间隔、重试次数等.
 */
class AsrConfig
{
    // ==================== 超时配置 ====================

    /**
     * 总结任务分布式锁 TTL（秒）.
     */
    public const int SUMMARY_LOCK_TTL = 1800;

    /**
     * 完成录音任务分布式锁 TTL（秒）.
     */
    public const int FINISH_RECORDING_LOCK_TTL = 120;

    /**
     * 心跳检测超时阈值（秒）.
     */
    public const int HEARTBEAT_TIMEOUT = 600;

    /**
     * 任务状态默认 TTL（秒）- 7天.
     */
    public const int TASK_STATUS_TTL = 604800;

    /**
     * 总结聊天消息去重 TTL（秒）.
     * 用于保证“最多发送一次”，避免 MQ 延迟重试/重复投递导致重复消息。
     */
    public const int SUMMARY_CHAT_DEDUP_TTL = 86400;

    /**
     * 沙箱音频合并的最长等待时间（秒）.
     */
    public const int SANDBOX_MERGE_TIMEOUT = 1200;

    /**
     * 音频文件记录查询超时（秒）.
     */
    public const int FILE_RECORD_QUERY_TIMEOUT = 120;

    /**
     * 沙箱启动超时（秒）.
     */
    public const int SANDBOX_STARTUP_TIMEOUT = 121;

    /**
     * 工作区初始化超时（秒）.
     */
    public const int WORKSPACE_INIT_TIMEOUT = 60;

    // ==================== 轮询间隔配置 ====================

    /**
     * 轮询间隔（秒）.
     */
    public const int POLLING_INTERVAL = 2;

    // ==================== 重试配置 ====================

    /**
     * 服务端自动总结最大重试次数.
     */
    public const int SERVER_SUMMARY_MAX_RETRY = 10;

    /**
     * MQ 总结重试锁 TTL（秒）.
     */
    public const int SUMMARY_MQ_RETRY_LOCK_TTL = 1800;

    // ==================== 日志记录配置 ====================

    /**
     * 沙箱音频合并日志记录间隔（秒）.
     */
    public const int SANDBOX_MERGE_LOG_INTERVAL = 10;

    /**
     * 沙箱音频合并日志记录频率（每N次尝试记录一次）.
     */
    public const int SANDBOX_MERGE_LOG_FREQUENCY = 10;

    /**
     * 音频文件记录查询日志记录频率（每N次尝试记录一次）.
     */
    public const int FILE_RECORD_QUERY_LOG_FREQUENCY = 3;

    // ==================== Redis 配置 ====================

    /**
     * Redis 扫描批次大小.
     */
    public const int REDIS_SCAN_BATCH_SIZE = 200;

    /**
     * Redis 扫描最大数量.
     */
    public const int REDIS_SCAN_MAX_COUNT = 2000;
}
