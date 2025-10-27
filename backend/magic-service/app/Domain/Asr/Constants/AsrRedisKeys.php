<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Constants;

/**
 * ASR Redis Key 常量
 * 统一管理 ASR 相关的 Redis Key 格式.
 */
class AsrRedisKeys
{
    /**
     * 任务状态 Hash Key 格式
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const TASK_HASH = 'asr:task:%s';

    /**
     * 心跳 Key 格式
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const HEARTBEAT = 'asr:heartbeat:%s';

    /**
     * 总结任务锁 Key 格式.
     */
    public const SUMMARY_LOCK = 'asr:summary:task:%s';

    /**
     * 任务状态扫描模式.
     */
    public const TASK_SCAN_PATTERN = 'asr:task:*';

    /**
     * 心跳扫描模式.
     */
    public const HEARTBEAT_SCAN_PATTERN = 'asr:heartbeat:*';

    /**
     * Mock 轮询计数 Key 格式（仅用于测试）.
     */
    public const MOCK_FINISH_COUNT = 'mock:asr:task:%s:finish_count';
}
