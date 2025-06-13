<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\File\Service;

use App\Domain\File\Constant\FileBatchConstant;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File batch status manager.
 *
 * Provides unified interface for managing file batch processing status,
 * user permissions, and distributed locks
 */
class FileBatchStatusManager
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileBatchStatus');
    }

    // ====== Task Lifecycle Management ======

    /**
     * Initialize a new batch task.
     *
     * @param string $batchKey Batch key
     * @param string $userId User ID
     * @param int $totalFiles Total number of files
     * @return bool True if successful, false otherwise
     */
    public function initializeTask(string $batchKey, string $userId, int $totalFiles): bool
    {
        try {
            $taskKey = FileBatchConstant::getTaskKey($batchKey);

            $taskData = [
                'status' => FileBatchConstant::STATUS_PROCESSING,
                'message' => FileBatchConstant::MSG_TASK_INITIALIZING,
                'progress' => [
                    'current' => 0,
                    'total' => $totalFiles,
                    'percentage' => 0.0,
                    'message' => 'Starting batch process',
                ],
                'result' => null,
                'error' => null,
                'created_at' => time(),
                'updated_at' => time(),
            ];

            $success = $this->redis->setex(
                $taskKey,
                FileBatchConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Set user permission
                $this->setUserPermission($batchKey, $userId);

                $this->logger->info('Batch task initialized', [
                    'batch_key' => $batchKey,
                    'user_id' => $userId,
                    'total_files' => $totalFiles,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to initialize batch task', [
                'batch_key' => $batchKey,
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
    public function setTaskProgress(string $batchKey, int $current, int $total, string $message = ''): bool
    {
        try {
            $taskKey = FileBatchConstant::getTaskKey($batchKey);
            $taskData = $this->getTaskData($batchKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when updating progress', [
                    'batch_key' => $batchKey,
                    'current' => $current,
                    'total' => $total,
                ]);
                return false;
            }

            // Update progress
            $percentage = $total > 0 ? round(($current / $total) * 100, 2) : 0.0;
            $taskData['progress'] = [
                'current' => $current,
                'total' => $total,
                'percentage' => $percentage,
                'message' => $message ?: FileBatchConstant::MSG_TASK_PROCESSING,
            ];
            $taskData['updated_at'] = time();

            $success = $this->redis->setex(
                $taskKey,
                FileBatchConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                $this->logger->debug('Task progress updated', [
                    'batch_key' => $batchKey,
                    'progress' => $percentage,
                    'current' => $current,
                    'total' => $total,
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
            $taskKey = FileBatchConstant::getTaskKey($batchKey);
            $taskData = $this->getTaskData($batchKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when marking completed', [
                    'batch_key' => $batchKey,
                ]);
                return false;
            }

            // Update to completed status
            $taskData['status'] = FileBatchConstant::STATUS_READY;
            $taskData['message'] = FileBatchConstant::MSG_TASK_COMPLETED;
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
                FileBatchConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Release processing lock
                $this->releaseLock($batchKey);

                $this->logger->info('Task completed successfully', [
                    'batch_key' => $batchKey,
                    'file_count' => $result['file_count'] ?? 0,
                    'zip_size' => $result['zip_size'] ?? 0,
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
            $taskKey = FileBatchConstant::getTaskKey($batchKey);
            $taskData = $this->getTaskData($batchKey);

            if (! $taskData) {
                // Create minimal task data if not exists
                $taskData = [
                    'status' => FileBatchConstant::STATUS_FAILED,
                    'message' => FileBatchConstant::MSG_TASK_FAILED,
                    'progress' => null,
                    'result' => null,
                    'error' => $error,
                    'created_at' => time(),
                    'updated_at' => time(),
                ];
            } else {
                // Update existing task data
                $taskData['status'] = FileBatchConstant::STATUS_FAILED;
                $taskData['message'] = FileBatchConstant::MSG_TASK_FAILED;
                $taskData['result'] = null;
                $taskData['error'] = $error;
                $taskData['updated_at'] = time();
            }

            $success = $this->redis->setex(
                $taskKey,
                FileBatchConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Release processing lock
                $this->releaseLock($batchKey);

                $this->logger->error('Task failed', [
                    'batch_key' => $batchKey,
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

    // ====== Status Query Methods ======

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
     * Check if task is completed.
     *
     * @param string $batchKey Batch key
     * @return bool True if completed, false otherwise
     */
    public function isTaskCompleted(string $batchKey): bool
    {
        $taskData = $this->getTaskData($batchKey);
        return $taskData && $taskData['status'] === FileBatchConstant::STATUS_READY;
    }

    /**
     * Check if task is failed.
     *
     * @param string $batchKey Batch key
     * @return bool True if failed, false otherwise
     */
    public function isTaskFailed(string $batchKey): bool
    {
        $taskData = $this->getTaskData($batchKey);
        return $taskData && $taskData['status'] === FileBatchConstant::STATUS_FAILED;
    }

    // ====== User Permission Management ======

    /**
     * Set user permission for batch access.
     *
     * @param string $batchKey Batch key
     * @param string $userId User ID
     * @param int $ttl TTL in seconds
     * @return bool True if successful, false otherwise
     */
    public function setUserPermission(string $batchKey, string $userId, int $ttl = FileBatchConstant::TTL_USER_PERMISSION): bool
    {
        try {
            $userKey = FileBatchConstant::getUserKey($batchKey);
            $success = $this->redis->setex($userKey, $ttl, $userId);

            if ($success) {
                $this->logger->debug('User permission set', [
                    'batch_key' => $batchKey,
                    'user_id' => $userId,
                    'ttl' => $ttl,
                ]);
            }

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
     * Verify user permission for batch access.
     *
     * @param string $batchKey Batch key
     * @param string $userId User ID
     * @return bool True if authorized, false otherwise
     */
    public function verifyUserPermission(string $batchKey, string $userId): bool
    {
        try {
            $userKey = FileBatchConstant::getUserKey($batchKey);
            $cachedUserId = $this->redis->get($userKey);

            $authorized = $cachedUserId && $cachedUserId === $userId;

            if (! $authorized) {
                $this->logger->warning('User permission denied', [
                    'batch_key' => $batchKey,
                    'user_id' => $userId,
                    'cached_user_id' => $cachedUserId,
                ]);
            }

            return $authorized;
        } catch (Throwable $e) {
            $this->logger->error('Failed to verify user permission', [
                'batch_key' => $batchKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Lock Management ======

    /**
     * Acquire processing lock.
     *
     * @param string $batchKey Batch key
     * @param int $ttl TTL in seconds
     * @return bool True if lock acquired, false otherwise
     */
    public function acquireLock(string $batchKey, int $ttl = FileBatchConstant::TTL_PROCESSING_LOCK): bool
    {
        try {
            $lockKey = FileBatchConstant::getLockKey($batchKey);
            $acquired = $this->redis->set($lockKey, 1, ['nx', 'ex' => $ttl]);

            if ($acquired) {
                $this->logger->debug('Processing lock acquired', [
                    'batch_key' => $batchKey,
                    'ttl' => $ttl,
                ]);
            } else {
                $this->logger->info('Processing lock already exists', [
                    'batch_key' => $batchKey,
                ]);
            }

            return (bool) $acquired;
        } catch (Throwable $e) {
            $this->logger->error('Failed to acquire processing lock', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Release processing lock.
     *
     * @param string $batchKey Batch key
     * @return bool True if released, false otherwise
     */
    public function releaseLock(string $batchKey): bool
    {
        try {
            $lockKey = FileBatchConstant::getLockKey($batchKey);
            $released = $this->redis->del($lockKey);

            // Ensure we have a valid result for boolean conversion
            $released = is_int($released) ? $released > 0 : (bool) $released;

            if ($released) {
                $this->logger->debug('Processing lock released', [
                    'batch_key' => $batchKey,
                ]);
            }

            return $released;
        } catch (Throwable $e) {
            $this->logger->error('Failed to release processing lock', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Cleanup Methods ======

    /**
     * Clean up all cache entries for a batch.
     *
     * @param string $batchKey Batch key
     * @return bool True if cleanup successful, false otherwise
     */
    public function cleanupTask(string $batchKey): bool
    {
        try {
            $keys = FileBatchConstant::getAllKeys($batchKey);
            $deletedCount = $this->redis->del(...array_values($keys));

            // Ensure we have a valid integer for comparison
            $deletedCount = is_int($deletedCount) ? $deletedCount : 0;

            $this->logger->info('Batch task cleaned up', [
                'batch_key' => $batchKey,
                'deleted_keys' => $deletedCount,
            ]);

            return $deletedCount > 0;
        } catch (Throwable $e) {
            $this->logger->error('Failed to cleanup batch task', [
                'batch_key' => $batchKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Private Helper Methods ======

    /**
     * Get task data from cache.
     *
     * @param string $batchKey Batch key
     * @return null|array Task data or null if not found
     */
    private function getTaskData(string $batchKey): ?array
    {
        try {
            $taskKey = FileBatchConstant::getTaskKey($batchKey);
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
}
