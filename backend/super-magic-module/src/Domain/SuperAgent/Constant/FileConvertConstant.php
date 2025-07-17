<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

/**
 * File conversion processing related constants.
 */
class FileConvertConstant
{
    // ====== Cache Key Prefixes ======

    /**
     * Main cache key prefix for file conversion processing.
     */
    public const CACHE_PREFIX = 'convert_file:';

    /**
     * Cache key templates.
     */
    public const CACHE_KEY_TASK = self::CACHE_PREFIX . 'task:';        // Task status and progress

    public const CACHE_KEY_USER = self::CACHE_PREFIX . 'user:';        // User permission

    public const CACHE_KEY_LOCK = self::CACHE_PREFIX . 'lock:';        // Processing lock

    // ====== Task Status Constants ======
    // Status constants have been moved to ConvertStatusEnum
    // Use ConvertStatusEnum instead for status values

    // ====== TTL Constants (in seconds) ======

    /**
     * Task status cache TTL - 1 hour.
     */
    public const TTL_TASK_STATUS = 3600;

    /**
     * User permission cache TTL - 24 hours.
     */
    public const TTL_USER_PERMISSION = 86400;

    /**
     * Processing lock TTL - 1 hour.
     */
    public const TTL_PROCESSING_LOCK = 3600;

    // ====== File Processing Limits ======

    /**
     * Maximum number of files per conversion batch.
     */
    public const MAX_FILES_PER_BATCH = 100;

    /**
     * Maximum retry attempts for failed operations.
     */
    public const MAX_RETRY_ATTEMPTS = 3;

    // ====== Default Messages ======

    /**
     * Default status messages.
     */
    public const MSG_TASK_INITIALIZING = 'Initializing file conversion task';

    public const MSG_TASK_PROCESSING = 'Converting files';

    public const MSG_TASK_COMPLETED = 'Files converted successfully';

    public const MSG_TASK_FAILED = 'File conversion failed';

    // ====== Helper Methods ======

    /**
     * Generate task cache key.
     *
     * @param string $taskKey Task key
     * @return string Complete cache key
     */
    public static function getTaskKey(string $taskKey): string
    {
        return self::CACHE_KEY_TASK . $taskKey;
    }

    /**
     * Generate user permission cache key.
     *
     * @param string $taskKey Task key
     * @return string Complete cache key
     */
    public static function getUserKey(string $taskKey): string
    {
        return self::CACHE_KEY_USER . $taskKey;
    }

    /**
     * Generate processing lock cache key.
     *
     * @param string $taskKey Task key
     * @return string Complete cache key
     */
    public static function getLockKey(string $taskKey): string
    {
        return self::CACHE_KEY_LOCK . $taskKey;
    }

    /**
     * Check if status is valid.
     *
     * @param string $status Status to check
     * @return bool True if valid, false otherwise
     * @deprecated Use ConvertStatusEnum::isValid() instead
     */
    public static function isValidStatus(string $status): bool
    {
        return ConvertStatusEnum::isValid($status);
    }

    /**
     * Get all cache keys for a task.
     *
     * @param string $taskKey Task key
     * @return array Array of all cache keys
     */
    public static function getAllKeys(string $taskKey): array
    {
        return [
            'task' => self::getTaskKey($taskKey),
            'user' => self::getUserKey($taskKey),
            'lock' => self::getLockKey($taskKey),
        ];
    }
}
