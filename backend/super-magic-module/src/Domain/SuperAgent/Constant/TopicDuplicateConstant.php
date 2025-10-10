<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

/**
 * Topic duplication process constants.
 */
class TopicDuplicateConstant
{
    // ====== Cache Prefixes ======
    public const string CACHE_PREFIX = 'topic_duplicate:';

    public const string USER_KEY_PREFIX = 'topic_duplicate_user:';

    // ====== Cache TTL (seconds) ======
    public const int TTL_TASK_STATUS = 300;      // 5 minutes - enough for 30s task + queries

    public const int TTL_USER_PERMISSION = 300;   // 5 minutes - same as task status

    // ====== Status Messages ======
    public const string MSG_TASK_INITIALIZING = 'Initializing topic duplication';

    public const string MSG_TASK_PROCESSING = 'Topic duplication in progress';

    public const string MSG_TASK_COMPLETED = 'Topic duplication completed successfully';

    public const string MSG_TASK_FAILED = 'Topic duplication failed';

    // ====== Helper Methods ======

    /**
     * Get task cache key.
     */
    public static function getTaskKey(string $taskKey): string
    {
        return self::CACHE_PREFIX . 'task:' . $taskKey;
    }

    /**
     * Get user permission cache key.
     */
    public static function getUserKey(string $taskKey): string
    {
        return self::USER_KEY_PREFIX . $taskKey;
    }

    /**
     * Generate task key.
     * Format: duplicate_topic_{short_topic_id}_{user_hash}_{time_random}
     * Example: duplicate_topic_834909592_a1b2c3_67310x9k (about 42 characters).
     */
    public static function generateTaskKey(string $sourceTopicId, string $userId): string
    {
        // 1. 保留易识别的前缀
        $prefix = 'duplicate_topic';

        // 2. 缩短 topic_id (取后9位，足够区分)
        $shortTopicId = substr($sourceTopicId, -9);

        // 3. 用户ID哈希化 (取前6位MD5)
        $userHash = substr(md5($userId), 0, 6);

        // 4. 时间戳后5位 + 随机3位 = 8位混合标识符
        $timeSuffix = substr((string) time(), -5);
        $random = substr(uniqid(), -3);
        $timeRandom = $timeSuffix . $random;

        return sprintf('%s_%s_%s_%s', $prefix, $shortTopicId, $userHash, $timeRandom);
    }
}
