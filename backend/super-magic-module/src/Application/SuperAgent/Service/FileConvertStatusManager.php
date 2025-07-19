<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ConvertStatusEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\FileConvertConstant;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File conversion status manager.
 *
 * Provides unified interface for managing file conversion processing status,
 * user permissions, and distributed locks
 */
class FileConvertStatusManager
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileConvertStatus');
    }

    // ====== Task Lifecycle Management ======

    /**
     * Initialize a new conversion task.
     *
     * @param string $taskKey Task key
     * @param string $userId User ID
     * @param int $totalFiles Total number of files
     * @param string $convertType Convert type
     * @return bool True if successful, false otherwise
     */
    public function initializeTask(string $taskKey, string $userId, int $totalFiles, string $convertType): bool
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);

            $taskData = [
                'status' => ConvertStatusEnum::PROCESSING->value,
                'message' => FileConvertConstant::MSG_TASK_INITIALIZING,
                'convert_type' => $convertType,
                'progress' => [
                    'current' => 0,
                    'total' => $totalFiles,
                    'percentage' => 0.0,
                    'message' => 'Starting file conversion',
                ],
                'result' => null,
                'error' => null,
                'created_at' => time(),
                'updated_at' => time(),
            ];

            $success = $this->redis->setex(
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Set user permission
                $this->setUserPermission($taskKey, $userId);

                $this->logger->info('File conversion task initialized', [
                    'task_key' => $taskKey,
                    'user_id' => $userId,
                    'total_files' => $totalFiles,
                    'convert_type' => $convertType,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to initialize file conversion task', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'convert_type' => $convertType,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Update task progress.
     *
     * @param string $taskKey Task key
     * @param int $current Current progress
     * @param int $total Total items
     * @param string $message Progress message
     * @return bool True if successful, false otherwise
     */
    public function setTaskProgress(string $taskKey, int $current, int $total, string $message = ''): bool
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $taskData = $this->getTaskData($taskKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when updating progress', [
                    'task_key' => $taskKey,
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
                'message' => $message ?: FileConvertConstant::MSG_TASK_PROCESSING,
            ];
            $taskData['updated_at'] = time();

            $success = $this->redis->setex(
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                $this->logger->debug('Task progress updated', [
                    'task_key' => $taskKey,
                    'progress' => $percentage,
                    'current' => $current,
                    'total' => $total,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to update task progress', [
                'task_key' => $taskKey,
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
     * @param string $taskKey Task key
     * @param array $result Task result data
     * @return bool True if successful, false otherwise
     */
    public function setTaskCompleted(string $taskKey, array $result): bool
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $taskData = $this->getTaskData($taskKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when marking completed', [
                    'task_key' => $taskKey,
                ]);
                return false;
            }

            // Update to completed status
            $taskData['status'] = ConvertStatusEnum::COMPLETED->value;
            $taskData['message'] = FileConvertConstant::MSG_TASK_COMPLETED;
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
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Release processing lock
                $this->releaseLock($taskKey);

                $this->logger->info('File conversion task completed successfully', [
                    'task_key' => $taskKey,
                    'convert_type' => $taskData['convert_type'] ?? 'unknown',
                    'file_count' => $result['file_count'] ?? 0,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to mark task as completed', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Mark task as failed.
     *
     * @param string $taskKey Task key
     * @param string $error Error message
     * @return bool True if successful, false otherwise
     */
    public function setTaskFailed(string $taskKey, string $error): bool
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $taskData = $this->getTaskData($taskKey);

            if (! $taskData) {
                // Create minimal task data if not exists
                $taskData = [
                    'status' => ConvertStatusEnum::FAILED->value,
                    'message' => FileConvertConstant::MSG_TASK_FAILED,
                    'convert_type' => 'unknown',
                    'progress' => null,
                    'result' => null,
                    'error' => $error,
                    'created_at' => time(),
                    'updated_at' => time(),
                ];
            } else {
                // Update existing task data
                $taskData['status'] = ConvertStatusEnum::FAILED->value;
                $taskData['message'] = FileConvertConstant::MSG_TASK_FAILED;
                $taskData['result'] = null;
                $taskData['error'] = $error;
                $taskData['updated_at'] = time();
            }

            $success = $this->redis->setex(
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                // Release processing lock
                $this->releaseLock($taskKey);

                $this->logger->error('File conversion task failed', [
                    'task_key' => $taskKey,
                    'convert_type' => $taskData['convert_type'] ?? 'unknown',
                    'error' => $error,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to mark task as failed', [
                'task_key' => $taskKey,
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
     * @param string $taskKey Task key
     * @return null|array Task data or null if not found
     */
    public function getTaskStatus(string $taskKey): ?array
    {
        try {
            return $this->getTaskData($taskKey);
        } catch (Throwable $e) {
            $this->logger->error('Failed to get task status', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Check if task is completed.
     *
     * @param string $taskKey Task key
     * @return bool True if completed, false otherwise
     */
    public function isTaskCompleted(string $taskKey): bool
    {
        $taskData = $this->getTaskData($taskKey);
        return $taskData && $taskData['status'] === ConvertStatusEnum::COMPLETED->value;
    }

    /**
     * Check if task is failed.
     *
     * @param string $taskKey Task key
     * @return bool True if failed, false otherwise
     */
    public function isTaskFailed(string $taskKey): bool
    {
        $taskData = $this->getTaskData($taskKey);
        return $taskData && $taskData['status'] === ConvertStatusEnum::FAILED->value;
    }

    /**
     * Check if task is processing.
     *
     * @param string $taskKey Task key
     * @return bool True if processing, false otherwise
     */
    public function isTaskProcessing(string $taskKey): bool
    {
        $taskData = $this->getTaskData($taskKey);
        return $taskData && $taskData['status'] === ConvertStatusEnum::PROCESSING->value;
    }

    /**
     * Set sandbox ID for task.
     *
     * @param string $taskKey Task key
     * @param string $sandboxId Sandbox ID
     * @return bool True if successful, false otherwise
     */
    public function setSandboxId(string $taskKey, string $sandboxId): bool
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $taskData = $this->getTaskData($taskKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when setting sandbox ID', [
                    'task_key' => $taskKey,
                    'sandbox_id' => $sandboxId,
                ]);
                return false;
            }

            // Update sandbox ID
            $taskData['sandbox_id'] = $sandboxId;
            $taskData['updated_at'] = time();

            $success = $this->redis->setex(
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                $this->logger->debug('Task sandbox ID updated', [
                    'task_key' => $taskKey,
                    'sandbox_id' => $sandboxId,
                ]);
            }

            return $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to set sandbox ID', [
                'task_key' => $taskKey,
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Set project ID for task.
     *
     * @param string $taskKey Task key
     * @param string $projectId Project ID
     * @return bool True if successful, false otherwise
     */
    public function setProjectId(string $taskKey, string $projectId): bool
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $taskData = $this->getTaskData($taskKey);

            if (! $taskData) {
                $this->logger->warning('Task not found when setting project ID', [
                    'task_key' => $taskKey,
                    'project_id' => $projectId,
                ]);
                return false;
            }

            // Update project ID
            $taskData['project_id'] = $projectId;
            $taskData['updated_at'] = time();

            $success = $this->redis->setex(
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                json_encode($taskData, JSON_UNESCAPED_UNICODE)
            );

            if ($success) {
                $this->logger->debug('Task project ID updated', [
                    'task_key' => $taskKey,
                    'project_id' => $projectId,
                ]);
            }

            return $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to set project ID', [
                'task_key' => $taskKey,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Duplicate Request Management ======

    /**
     * Get duplicate task key for request.
     *
     * @param string $requestKey Request key
     * @return null|string Task key if exists, null otherwise
     */
    public function getDuplicateTaskKey(string $requestKey): ?string
    {
        try {
            $cacheKey = FileConvertConstant::CACHE_PREFIX . 'duplicate:' . $requestKey;
            $taskKey = $this->redis->get($cacheKey);

            if ($taskKey === false) {
                return null;
            }

            return $taskKey;
        } catch (Throwable $e) {
            $this->logger->error('Failed to get duplicate task key', [
                'request_key' => $requestKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Set duplicate task key for request.
     *
     * @param string $requestKey Request key
     * @param string $taskKey Task key
     * @param int $ttl TTL in seconds (default 1 minute)
     * @return bool True if successful, false otherwise
     */
    public function setDuplicateTaskKey(string $requestKey, string $taskKey, int $ttl = 60): bool
    {
        try {
            $cacheKey = FileConvertConstant::CACHE_PREFIX . 'duplicate:' . $requestKey;
            $success = $this->redis->setex($cacheKey, $ttl, $taskKey);

            if ($success) {
                $this->logger->debug('Duplicate task key set', [
                    'request_key' => $requestKey,
                    'task_key' => $taskKey,
                    'ttl' => $ttl,
                ]);
            }

            return $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to set duplicate task key', [
                'request_key' => $requestKey,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Clear duplicate task key for request.
     *
     * @param string $requestKey Request key
     * @return bool True if successful, false otherwise
     */
    public function clearDuplicateTaskKey(string $requestKey): bool
    {
        try {
            $cacheKey = FileConvertConstant::CACHE_PREFIX . 'duplicate:' . $requestKey;
            /* @phpstan-ignore-next-line */
            $success = $this->redis->del($cacheKey) > 0;

            if ($success) {
                $this->logger->debug('Duplicate task key cleared', [
                    'request_key' => $requestKey,
                ]);
            }

            return $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to clear duplicate task key', [
                'request_key' => $requestKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== User Permission Management ======

    /**
     * Set user permission for task access.
     *
     * @param string $taskKey Task key
     * @param string $userId User ID
     * @param int $ttl TTL in seconds
     * @return bool True if successful, false otherwise
     */
    public function setUserPermission(string $taskKey, string $userId, int $ttl = FileConvertConstant::TTL_USER_PERMISSION): bool
    {
        try {
            $userKey = FileConvertConstant::getUserKey($taskKey);
            $success = $this->redis->setex($userKey, $ttl, $userId);

            if ($success) {
                $this->logger->debug('User permission set', [
                    'task_key' => $taskKey,
                    'user_id' => $userId,
                    'ttl' => $ttl,
                ]);
            }

            return (bool) $success;
        } catch (Throwable $e) {
            $this->logger->error('Failed to set user permission', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Verify user permission for task access.
     *
     * @param string $taskKey Task key
     * @param string $userId User ID
     * @return bool True if authorized, false otherwise
     */
    public function verifyUserPermission(string $taskKey, string $userId): bool
    {
        try {
            $userKey = FileConvertConstant::getUserKey($taskKey);
            $cachedUserId = $this->redis->get($userKey);

            $authorized = $cachedUserId && $cachedUserId === $userId;

            if (! $authorized) {
                $this->logger->warning('User permission denied', [
                    'task_key' => $taskKey,
                    'user_id' => $userId,
                    'cached_user_id' => $cachedUserId,
                ]);
            }

            return $authorized;
        } catch (Throwable $e) {
            $this->logger->error('Failed to verify user permission', [
                'task_key' => $taskKey,
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
     * @param string $taskKey Task key
     * @param int $ttl TTL in seconds
     * @return bool True if lock acquired, false otherwise
     */
    public function acquireLock(string $taskKey, int $ttl = FileConvertConstant::TTL_PROCESSING_LOCK): bool
    {
        try {
            $lockKey = FileConvertConstant::getLockKey($taskKey);
            $acquired = $this->redis->set($lockKey, 1, ['nx', 'ex' => $ttl]);

            if ($acquired) {
                $this->logger->debug('Processing lock acquired', [
                    'task_key' => $taskKey,
                    'ttl' => $ttl,
                ]);
            } else {
                $this->logger->info('Processing lock already exists', [
                    'task_key' => $taskKey,
                ]);
            }

            return (bool) $acquired;
        } catch (Throwable $e) {
            $this->logger->error('Failed to acquire processing lock', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Release processing lock.
     *
     * @param string $taskKey Task key
     * @return bool True if released, false otherwise
     */
    public function releaseLock(string $taskKey): bool
    {
        try {
            $lockKey = FileConvertConstant::getLockKey($taskKey);
            $released = $this->redis->del($lockKey);

            // Ensure we have a valid result for boolean conversion
            $released = is_int($released) ? $released > 0 : (bool) $released;

            if ($released) {
                $this->logger->debug('Processing lock released', [
                    'task_key' => $taskKey,
                ]);
            }

            return $released;
        } catch (Throwable $e) {
            $this->logger->error('Failed to release processing lock', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Cleanup Methods ======

    /**
     * Clean up all cache entries for a task.
     *
     * @param string $taskKey Task key
     * @return bool True if cleanup successful, false otherwise
     */
    public function cleanupTask(string $taskKey): bool
    {
        try {
            $keys = FileConvertConstant::getAllKeys($taskKey);
            $deletedCount = $this->redis->del(...array_values($keys));

            // Ensure we have a valid integer for comparison
            $deletedCount = is_int($deletedCount) ? $deletedCount : 0;

            $this->logger->info('File conversion task cleaned up', [
                'task_key' => $taskKey,
                'deleted_keys' => $deletedCount,
            ]);

            return $deletedCount > 0;
        } catch (Throwable $e) {
            $this->logger->error('Failed to cleanup file conversion task', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Private Helper Methods ======

    /**
     * Get task data from cache.
     *
     * @param string $taskKey Task key
     * @return null|array Task data or null if not found
     */
    private function getTaskData(string $taskKey): ?array
    {
        try {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $data = $this->redis->get($cacheKey);

            if (! $data) {
                return null;
            }

            $decoded = json_decode($data, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->warning('Failed to decode task data JSON', [
                    'task_key' => $taskKey,
                    'json_error' => json_last_error_msg(),
                ]);
                return null;
            }

            return $decoded;
        } catch (Throwable $e) {
            $this->logger->error('Failed to get task data', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
