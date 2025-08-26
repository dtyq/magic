<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File batch operation status manager.
 *
 * Provides unified interface for managing file batch processing status,
 * user permissions, and distributed locks for all file operations.
 */
class FileBatchOperationStatusManager
{
    // Supported operation types
    public const OPERATION_RENAME = 'rename';

    public const OPERATION_DELETE = 'delete';

    public const OPERATION_MOVE = 'move';

    public const OPERATION_COPY = 'copy';

    // Task status constants
    public const STATUS_PROCESSING = 'processing';

    public const STATUS_SUCCESS = 'success';

    public const STATUS_FAILED = 'failed';

    // Valid statuses
    public const VALID_STATUSES = [
        self::STATUS_PROCESSING,
        self::STATUS_SUCCESS,
        self::STATUS_FAILED,
    ];

    private const CACHE_PREFIX = 'file_batch_operation:';

    // Cache key templates
    private const CACHE_KEY_TASK = self::CACHE_PREFIX . 'task:';

    private const CACHE_KEY_USER = self::CACHE_PREFIX . 'user:';

    private const CACHE_KEY_LOCK = self::CACHE_PREFIX . 'lock:';

    // TTL constants (in seconds)
    private const TTL_TASK_STATUS = 600;      // 10 min

    private const TTL_USER_PERMISSION = 1200; // 20 min

    private const TTL_PROCESSING_LOCK = 600;  // 10 min

    // Default messages
    private const MSG_TASK_INITIALIZING = 'Initializing batch task';

    private const MSG_TASK_PROCESSING = 'Processing files';

    private const MSG_TASK_COMPLETED = 'Files processed successfully';

    private const MSG_TASK_FAILED = 'Task failed';

    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileBatchOperation');
    }

    /**
     * Initialize batch operation task.
     *
     * @param string $batchKey Batch key
     * @param string $operation Operation type (rename|delete|move|copy)
     * @param string $userId User ID
     * @param int $totalFiles Total number of files
     * @param array $files Additional files data
     * @return bool True if successful, false otherwise
     */
    public function initializeTask(
        string $batchKey,
        string $operation,
        string $userId,
        int $totalFiles,
        array $files = []
    ): bool {
        try {
            $taskKey = $this->getTaskKey($batchKey);

            $taskData = [
                'status' => self::STATUS_PROCESSING,
                'operation' => $operation,
                'message' => self::MSG_TASK_INITIALIZING,
                'progress' => [
                    'current' => 0,
                    'total' => $totalFiles,
                    'percentage' => 0.0,
                    'message' => 'Starting batch process',
                ],
                'files' => $files,
                'result' => null,
                'error' => null,
                'created_at' => time(),
                'updated_at' => time(),
            ];

            $success = $this->redis->setex(
                $taskKey,
                self::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Set user permission
                $this->setUserPermission($batchKey, $userId);

                $this->logger->info('Batch operation task initialized', [
                    'batch_key' => $batchKey,
                    'operation' => $operation,
                    'user_id' => $userId,
                    'total_files' => $totalFiles,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to initialize batch operation task', [
                'batch_key' => $batchKey,
                'operation' => $operation,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Update task progress.
     *
     * @param string $batchKey Batch key
     * @param int $current Current progress
     * @param int $total Total items
     * @param string $message Progress message
     * @return bool True if successful, false otherwise
     */
    public function setTaskProgress(
        string $batchKey,
        int $current,
        int $total,
        string $message = ''
    ): bool {
        try {
            $taskKey = $this->getTaskKey($batchKey);
            $taskData = $this->getTaskData($batchKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when updating progress', [
                    'batch_key' => $batchKey,
                ]);
                return false;
            }

            // Calculate percentage
            $percentage = $total > 0 ? round(($current / $total) * 100, 2) : 0;

            // Update progress data
            $taskData['progress'] = [
                'current' => $current,
                'total' => $total,
                'percentage' => $percentage,
                'message' => $message ?: self::MSG_TASK_PROCESSING,
            ];
            $taskData['updated_at'] = time();

            $success = $this->redis->setex(
                $taskKey,
                self::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                $this->logger->debug('Task progress updated', [
                    'batch_key' => $batchKey,
                    'current' => $current,
                    'total' => $total,
                    'percentage' => $percentage,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to update task progress', [
                'batch_key' => $batchKey,
                'current' => $current,
                'total' => $total,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Mark task as completed.
     *
     * @param string $batchKey Batch key
     * @param array $result Task result data
     * @return bool True if successful, false otherwise
     */
    public function setTaskCompleted(string $batchKey, array $result): bool
    {
        try {
            $taskKey = $this->getTaskKey($batchKey);
            $taskData = $this->getTaskData($batchKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when marking completed', [
                    'batch_key' => $batchKey,
                ]);
                return false;
            }

            // Update to completed status
            $taskData['status'] = self::STATUS_SUCCESS;
            $taskData['message'] = self::MSG_TASK_COMPLETED;
            $taskData['result'] = $result;
            $taskData['error'] = null;
            $taskData['updated_at'] = time();

            // Set progress to 100%
            if (isset($taskData['progress'])) {
                $taskData['progress']['current'] = $taskData['progress']['total'];
                $taskData['progress']['percentage'] = 100.0;
                $taskData['progress']['message'] = 'Completed';
            }

            $success = $this->redis->setex(
                $taskKey,
                self::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Release processing lock
                $this->releaseLock($batchKey);

                $this->logger->info('Task completed successfully', [
                    'batch_key' => $batchKey,
                    'operation' => $taskData['operation'] ?? '',
                    'result_count' => $result['count'] ?? 0,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to mark task as completed', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Mark task as failed.
     *
     * @param string $batchKey Batch key
     * @param string $error Error message
     * @return bool True if successful, false otherwise
     */
    public function setTaskFailed(string $batchKey, string $error): bool
    {
        try {
            $taskKey = $this->getTaskKey($batchKey);
            $taskData = $this->getTaskData($batchKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when marking failed', [
                    'batch_key' => $batchKey,
                ]);
                return false;
            }

            // Update to failed status
            $taskData['status'] = self::STATUS_FAILED;
            $taskData['message'] = self::MSG_TASK_FAILED;
            $taskData['error'] = $error;
            $taskData['result'] = null;
            $taskData['updated_at'] = time();

            // Update progress message
            if (isset($taskData['progress'])) {
                $taskData['progress']['message'] = 'Failed: ' . $error;
            }

            $success = $this->redis->setex(
                $taskKey,
                self::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Release processing lock
                $this->releaseLock($batchKey);

                $this->logger->error('Task marked as failed', [
                    'batch_key' => $batchKey,
                    'operation' => $taskData['operation'] ?? '',
                    'error' => $error,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to mark task as failed', [
                'batch_key' => $batchKey,
                'original_error' => $error,
                'redis_error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get task status.
     *
     * @param string $batchKey Batch key
     * @return null|array Task data or null if not found
     */
    public function getTaskStatus(string $batchKey): ?array
    {
        try {
            return $this->getTaskData($batchKey);
        } catch (Throwable $e) {
            $this->logger->error('Failed to get task status', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Verify user permission for batch access.
     *
     * @param string $batchKey Batch key
     * @param string $userId User ID
     * @return bool True if user has permission, false otherwise
     */
    public function verifyUserPermission(string $batchKey, string $userId): bool
    {
        try {
            $userKey = $this->getUserKey($batchKey);
            $storedUserId = $this->redis->get($userKey);

            return $storedUserId === $userId;
        } catch (Throwable $e) {
            $this->logger->error('Failed to verify user permission', [
                'batch_key' => $batchKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Generate batch key based on operation type.
     *
     * @param string $operation Operation type
     * @param string $userId User ID
     * @param string $resourceId Resource ID (optional)
     * @return string Generated batch key
     */
    public function generateBatchKey(string $operation, string $userId, string $resourceId = ''): string
    {
        $data = $operation . '|' . $userId . '|' . $resourceId . '|' . time() . '|' . mt_rand(1000, 9999);
        return 'batch_' . $operation . '_' . md5($data);
    }

    /**
     * Acquire processing lock for batch task.
     *
     * @param string $batchKey Batch key
     * @return bool True if lock acquired, false otherwise
     */
    public function acquireLock(string $batchKey): bool
    {
        try {
            $lockKey = $this->getLockKey($batchKey);
            $lockValue = time() . '_' . mt_rand(1000, 9999);

            // Use SET with NX (only if not exists) and EX (expiration)
            $result = $this->redis->set($lockKey, $lockValue, ['NX', 'EX' => self::TTL_PROCESSING_LOCK]);

            return $result === true;
        } catch (Throwable $e) {
            $this->logger->error('Failed to acquire processing lock', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Release processing lock for batch task.
     *
     * @param string $batchKey Batch key
     * @return bool True if lock released, false otherwise
     */
    public function releaseLock(string $batchKey): bool
    {
        try {
            $lockKey = $this->getLockKey($batchKey);
            $this->redis->del($lockKey);

            return true;
        } catch (Throwable $e) {
            $this->logger->error('Failed to release processing lock', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Clean up all data for a batch task.
     *
     * @param string $batchKey Batch key
     * @return bool True if cleanup successful, false otherwise
     */
    public function cleanupTask(string $batchKey): bool
    {
        try {
            $keys = [
                $this->getTaskKey($batchKey),
                $this->getUserKey($batchKey),
                $this->getLockKey($batchKey),
            ];

            $deletedCount = $this->redis->del(...$keys);

            $this->logger->info('Batch task cleaned up', [
                'batch_key' => $batchKey,
                'deleted_keys' => $deletedCount,
            ]);

            return true;
        } catch (Throwable $e) {
            $this->logger->error('Failed to cleanup batch task', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check if operation type is valid.
     *
     * @param string $operation Operation type
     * @return bool True if valid, false otherwise
     */
    public static function isValidOperation(string $operation): bool
    {
        return in_array($operation, [
            self::OPERATION_RENAME,
            self::OPERATION_DELETE,
            self::OPERATION_MOVE,
            self::OPERATION_COPY,
        ], true);
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
     * Set user permission for batch access.
     *
     * @param string $batchKey Batch key
     * @param string $userId User ID
     * @param int $ttl TTL in seconds
     * @return bool True if successful, false otherwise
     */
    private function setUserPermission(string $batchKey, string $userId, int $ttl = self::TTL_USER_PERMISSION): bool
    {
        try {
            $userKey = $this->getUserKey($batchKey);
            $success = $this->redis->setex($userKey, $ttl, $userId);

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to set user permission', [
                'batch_key' => $batchKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get task data from Redis.
     *
     * @param string $batchKey Batch key
     * @return null|array Task data or null if not found
     */
    private function getTaskData(string $batchKey): ?array
    {
        try {
            $taskKey = $this->getTaskKey($batchKey);
            $data = $this->redis->get($taskKey);

            if (! $data) {
                return null;
            }

            $decoded = json_decode($data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->warning('Failed to decode task data JSON', [
                    'batch_key' => $batchKey,
                    'json_error' => json_last_error_msg(),
                ]);
                return null;
            }

            return $decoded;
        } catch (Throwable $e) {
            $this->logger->error('Failed to get task data', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Generate task cache key.
     *
     * @param string $batchKey Batch key
     * @return string Complete cache key
     */
    private function getTaskKey(string $batchKey): string
    {
        return self::CACHE_KEY_TASK . $batchKey;
    }

    /**
     * Generate user permission cache key.
     *
     * @param string $batchKey Batch key
     * @return string Complete cache key
     */
    private function getUserKey(string $batchKey): string
    {
        return self::CACHE_KEY_USER . $batchKey;
    }

    /**
     * Generate processing lock cache key.
     *
     * @param string $batchKey Batch key
     * @return string Complete cache key
     */
    private function getLockKey(string $batchKey): string
    {
        return self::CACHE_KEY_LOCK . $batchKey;
    }
}
