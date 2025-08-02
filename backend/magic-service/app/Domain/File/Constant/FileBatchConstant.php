<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Constant;

/**
 * File batch processing related constants.
 */
class FileBatchConstant
{
    // ====== Cache Key Prefixes ======

    /**
     * Main cache key prefix for file batch processing.
     */
    public const CACHE_PREFIX = 'compress_file:';

    /**
     * Cache key templates.
     */
    public const CACHE_KEY_TASK = self::CACHE_PREFIX . 'task:';        // Task status and progress

    public const CACHE_KEY_USER = self::CACHE_PREFIX . 'user:';        // User permission

    public const CACHE_KEY_LOCK = self::CACHE_PREFIX . 'lock:';        // Processing lock

    // ====== Task Status Constants ======

    /**
     * Task status enums.
     */
    public const STATUS_PROCESSING = 'processing';   // Task is being processed

    public const STATUS_READY = 'ready';            // Task completed successfully

    public const STATUS_FAILED = 'failed';          // Task failed

    /**
     * All valid status values.
     */
    public const VALID_STATUSES = [
        self::STATUS_PROCESSING,
        self::STATUS_READY,
        self::STATUS_FAILED,
    ];

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
     * Maximum number of files per batch.
     */
    public const MAX_FILES_PER_BATCH = 50;

    /**
     * Maximum retry attempts for failed operations.
     */
    public const MAX_RETRY_ATTEMPTS = 3;

    // ====== Default Messages ======

    /**
     * Default status messages.
     */
    public const MSG_TASK_INITIALIZING = 'Initializing batch task';

    public const MSG_TASK_PROCESSING = 'Processing files';

    public const MSG_TASK_COMPLETED = 'Files processed successfully';

    public const MSG_TASK_FAILED = 'Task failed';

    // ====== Helper Methods ======

    /**
     * Generate task cache key.
     *
     * @param string $batchKey Batch key
     * @return string Complete cache key
     */
    public static function getTaskKey(string $batchKey): string
    {
        return self::CACHE_KEY_TASK . $batchKey;
    }

    /**
     * Generate user permission cache key.
     *
     * @param string $batchKey Batch key
     * @return string Complete cache key
     */
    public static function getUserKey(string $batchKey): string
    {
        return self::CACHE_KEY_USER . $batchKey;
    }

    /**
     * Generate processing lock cache key.
     *
     * @param string $batchKey Batch key
     * @return string Complete cache key
     */
    public static function getLockKey(string $batchKey): string
    {
        return self::CACHE_KEY_LOCK . $batchKey;
    }

    /**
     * Check if status is valid.
     *
     * @param string $status Status to check
     * @return bool True if valid, false otherwise
     */
    public static function isValidStatus(string $status): bool
    {
        return in_array($status, self::VALID_STATUSES, true);
    }

    /**
     * Get all cache keys for a batch.
     *
     * @param string $batchKey Batch key
     * @return array Array of all cache keys
     */
    public static function getAllKeys(string $batchKey): array
    {
        return [
            'task' => self::getTaskKey($batchKey),
            'user' => self::getUserKey($batchKey),
            'lock' => self::getLockKey($batchKey),
        ];
    }
}
