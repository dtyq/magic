<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Constants;

/**
 * ASR 超时配置常量
 * 统一管理 ASR 相关的超时时间配置.
 */
class AsrTimeouts
{
    /**
     * 总结任务分布式锁 TTL（秒）.
     */
    public const int SUMMARY_LOCK_TTL = 120;

    /**
     * 心跳检测超时阈值（秒）.
     */
    public const int HEARTBEAT_TIMEOUT = 600;

    /**
     * 服务端自动总结最大重试次数.
     */
    public const int SERVER_SUMMARY_MAX_RETRY = 10;

    /**
     * 任务状态默认 TTL（秒）- 7天.
     */
    public const int TASK_STATUS_TTL = 604800;

    /**
     * Mock 轮询状态 TTL（秒）- 仅测试用.
     */
    public const int MOCK_POLLING_TTL = 600;

    /**
     * 沙箱音频合并的最长等待时间（秒）.
     */
    public const int SANDBOX_MERGE_TIMEOUT = 1200;

    /**
     * 沙箱音频合并轮询间隔（秒）.
     */
    public const int SANDBOX_MERGE_POLLING_INTERVAL = 5;
}
