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
    public const SUMMARY_LOCK_TTL = 120;

    /**
     * API 层总结快速锁 TTL（秒）.
     */
    public const SUMMARY_QUICK_LOCK_TTL = 30;

    /**
     * 心跳检测超时阈值（秒）.
     */
    public const HEARTBEAT_TIMEOUT = 90;

    /**
     * 心跳 Key 过期时间（秒）.
     */
    public const HEARTBEAT_TTL = 300;

    /**
     * 任务状态默认 TTL（秒）- 7天.
     */
    public const TASK_STATUS_TTL = 604800;

    /**
     * Mock 轮询状态 TTL（秒）- 仅测试用.
     */
    public const MOCK_POLLING_TTL = 600;
}
