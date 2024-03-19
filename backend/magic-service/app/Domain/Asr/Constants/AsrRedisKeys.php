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
    public const string TASK_HASH = 'asr:task:%s';

    /**
     * 心跳 Key 格式
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const string HEARTBEAT = 'asr:heartbeat:%s';

    /**
     * 总结任务锁 Key 格式.
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const string SUMMARY_LOCK = 'asr:summary:task:%s';

    /**
     * MQ 总结任务重试计数 Key 格式.
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const string SUMMARY_MQ_RETRY = 'asr:summary:mq_retry:%s';

    /**
     * MQ 总结任务重试锁 Key 格式.
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const string SUMMARY_MQ_RETRY_LOCK = 'asr:summary:mq_retry_lock:%s';

    /**
     * 总结聊天消息去重 Key 格式（避免 MQ 重试导致重复发送）.
     * 实际使用时会 MD5(user_id:task_key).
     */
    public const string SUMMARY_CHAT_DEDUP = 'asr:summary:chat_dedup:%s';

    /**
     * 完成录音任务锁 Key 格式.
     */
    public const FINISH_RECORDING_LOCK = 'asr:finish_recording_lock:%s';

    /**
     * 任务状态扫描模式.
     */
    public const string TASK_SCAN_PATTERN = 'asr:task:*';

    /**
     * 心跳扫描模式.
     */
    public const string HEARTBEAT_SCAN_PATTERN = 'asr:heartbeat:*';
}
