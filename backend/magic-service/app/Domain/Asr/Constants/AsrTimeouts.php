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
    public const int HEARTBEAT_TIMEOUT = 60;

    /**
     * 任务状态默认 TTL（秒）- 7天.
     */
    public const int TASK_STATUS_TTL = 604800;

    /**
     * Mock 轮询状态 TTL（秒）- 仅测试用.
     */
    public const int MOCK_POLLING_TTL = 600;
}
