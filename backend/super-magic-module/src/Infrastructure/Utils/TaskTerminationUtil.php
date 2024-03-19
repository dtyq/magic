<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Task Termination Utility.
 *
 * Simple utility for managing task termination flags using Redis.
 */
class TaskTerminationUtil
{
    /**
     * Redis key prefix for task termination flags.
     */
    private const KEY_PREFIX = 'task_terminated:';

    /**
     * Default TTL for termination flags (30 minutes).
     */
    private const DEFAULT_TTL = 1800;

    /**
     * Set task termination flag in Redis.
     *
     * @param Redis $redis Redis instance
     * @param LoggerInterface $logger Logger instance
     * @param int|string $taskId Task ID
     * @param int $ttl Time to live in seconds (default: 1800 = 30 minutes)
     * @return bool True if flag was set successfully, false otherwise
     */
    public static function setTerminationFlag(
        Redis $redis,
        LoggerInterface $logger,
        int|string $taskId,
        int $ttl = self::DEFAULT_TTL
    ): bool {
        $taskTerminationKey = self::KEY_PREFIX . $taskId;

        try {
            $result = $redis->setex($taskTerminationKey, $ttl, '1');

            $logger->info(sprintf(
                'Task termination flag set for task_id: %s, ttl: %d seconds',
                $taskId,
                $ttl
            ));

            return (bool) $result;
        } catch (Throwable $e) {
            $logger->error(sprintf(
                'Failed to set task termination flag for task_id: %s, error: %s',
                $taskId,
                $e->getMessage()
            ));

            return false;
        }
    }

    /**
     * Check if task has been terminated by user.
     *
     * @param Redis $redis Redis instance
     * @param LoggerInterface $logger Logger instance
     * @param int|string $taskId Task ID
     * @return bool True if task is terminated, false otherwise
     */
    public static function isTaskTerminated(
        Redis $redis,
        LoggerInterface $logger,
        int|string $taskId
    ): bool {
        if (empty($taskId)) {
            return false;
        }

        $taskTerminationKey = self::KEY_PREFIX . $taskId;

        try {
            $isTerminated = $redis->get($taskTerminationKey);

            if ($isTerminated) {
                $logger->info(sprintf(
                    'Task has been terminated by user, skipping processing, task_id: %s',
                    $taskId
                ));

                return true;
            }

            return false;
        } catch (Throwable $e) {
            $logger->error(sprintf(
                'Failed to check task termination status, task_id: %s, error: %s, continuing processing',
                $taskId,
                $e->getMessage()
            ));

            // Redis check failure should not block processing
            return false;
        }
    }
}
