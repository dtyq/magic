<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ConvertStatusEnum;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\FileConvertConstant;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * File conversion status manager.
 *
 * Provides unified interface for managing file conversion processing status,
 * user permissions, and distributed locks
 */
class FileConvertStatusManager
{
    private const string LOCK_OWNER = 'file_convert_task';

    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('FileConvertStatus');
    }

    // ====== Task Lifecycle Management ======

    /**
     * Initialize a new conversion task.
     */
    public function initializeTask(string $taskKey, string $userId, int $totalFiles, string $convertType): bool
    {
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

        $success = $this->setTaskData($taskKey, $taskData) && $this->setUserPermission($taskKey, $userId);

        if (! $success) {
            $this->logger->error('Failed to initialize file conversion task', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'convert_type' => $convertType,
            ]);
        }

        return $success;
    }

    /**
     * Update task progress.
     */
    public function setTaskProgress(string $taskKey, int $current, int $total, string $message = ''): bool
    {
        $taskData = $this->getTaskData($taskKey);
        if (! $taskData) {
            return false;
        }

        $percentage = $total > 0 ? round(($current / $total) * 100, 2) : 0.0;
        $taskData['progress'] = [
            'current' => $current,
            'total' => $total,
            'percentage' => $percentage,
            'message' => $message ?: FileConvertConstant::MSG_TASK_PROCESSING,
        ];
        $taskData['updated_at'] = time();

        return $this->setTaskData($taskKey, $taskData);
    }

    /**
     * Mark task as completed.
     */
    public function setTaskCompleted(string $taskKey, array $result): bool
    {
        $taskData = $this->getTaskData($taskKey);
        if (! $taskData) {
            return false;
        }

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

        $success = $this->setTaskData($taskKey, $taskData);
        if ($success) {
            $this->releaseLock($taskKey);
        }

        return $success;
    }

    /**
     * Mark task as failed.
     */
    public function setTaskFailed(string $taskKey, string $error): bool
    {
        $taskData = $this->getTaskData($taskKey) ?: [
            'status' => ConvertStatusEnum::FAILED->value,
            'message' => FileConvertConstant::MSG_TASK_FAILED,
            'convert_type' => 'unknown',
            'progress' => null,
            'result' => null,
            'created_at' => time(),
        ];

        $taskData['status'] = ConvertStatusEnum::FAILED->value;
        $taskData['message'] = FileConvertConstant::MSG_TASK_FAILED;
        $taskData['result'] = null;
        $taskData['error'] = $error;
        $taskData['updated_at'] = time();

        $success = $this->setTaskData($taskKey, $taskData);
        if ($success) {
            $this->releaseLock($taskKey);
            $this->logger->error('File conversion task failed', [
                'task_key' => $taskKey,
                'convert_type' => $taskData['convert_type'] ?? 'unknown',
                'error' => $error,
            ]);
        }

        return $success;
    }

    // ====== Status Query Methods ======

    /**
     * Get task status.
     */
    public function getTaskStatus(string $taskKey): ?array
    {
        return $this->getTaskData($taskKey);
    }

    /**
     * Check if task is completed.
     */
    public function isTaskCompleted(string $taskKey): bool
    {
        return $this->hasTaskStatus($taskKey, ConvertStatusEnum::COMPLETED->value);
    }

    /**
     * Check if task is failed.
     */
    public function isTaskFailed(string $taskKey): bool
    {
        return $this->hasTaskStatus($taskKey, ConvertStatusEnum::FAILED->value);
    }

    /**
     * Check if task is processing.
     */
    public function isTaskProcessing(string $taskKey): bool
    {
        return $this->hasTaskStatus($taskKey, ConvertStatusEnum::PROCESSING->value);
    }

    /**
     * Set task metadata (sandbox_id, project_id, etc.).
     */
    public function setTaskMetadata(string $taskKey, array $metadata): bool
    {
        $taskData = $this->getTaskData($taskKey);
        if (! $taskData) {
            return false;
        }

        foreach ($metadata as $field => $value) {
            $taskData[$field] = $value;
        }
        $taskData['updated_at'] = time();

        return $this->setTaskData($taskKey, $taskData);
    }

    // ====== Duplicate Request Management ======

    /**
     * Get duplicate task key for request.
     */
    public function getDuplicateTaskKey(string $requestKey): ?string
    {
        return $this->executeRedisOperation(function () use ($requestKey) {
            $cacheKey = FileConvertConstant::CACHE_PREFIX . 'duplicate:' . $requestKey;
            $taskKey = $this->redis->get($cacheKey);
            return $taskKey === false ? null : $taskKey;
        }, 'get duplicate task key', ['request_key' => $requestKey]);
    }

    /**
     * Set duplicate task key for request.
     */
    public function setDuplicateTaskKey(string $requestKey, string $taskKey, int $ttl = 60): bool
    {
        return $this->executeRedisOperation(function () use ($requestKey, $taskKey, $ttl) {
            $cacheKey = FileConvertConstant::CACHE_PREFIX . 'duplicate:' . $requestKey;
            return $this->redis->setex($cacheKey, $ttl, $taskKey);
        }, 'set duplicate task key', ['request_key' => $requestKey, 'task_key' => $taskKey]);
    }

    /**
     * Clear duplicate task key for request.
     */
    public function clearDuplicateTaskKey(string $requestKey): bool
    {
        return $this->executeRedisOperation(function () use ($requestKey) {
            $cacheKey = FileConvertConstant::CACHE_PREFIX . 'duplicate:' . $requestKey;
            return $this->redis->del($cacheKey) > 0;
        }, 'clear duplicate task key', ['request_key' => $requestKey]);
    }

    // ====== User Permission Management ======

    /**
     * Set user permission for task access.
     */
    public function setUserPermission(string $taskKey, string $userId, int $ttl = FileConvertConstant::TTL_USER_PERMISSION): bool
    {
        return $this->executeRedisOperation(function () use ($taskKey, $userId, $ttl) {
            $userKey = FileConvertConstant::getUserKey($taskKey);
            return $this->redis->setex($userKey, $ttl, $userId);
        }, 'set user permission', ['task_key' => $taskKey, 'user_id' => $userId]);
    }

    /**
     * Verify user permission for task access.
     */
    public function verifyUserPermission(string $taskKey, string $userId): bool
    {
        $cachedUserId = $this->executeRedisOperation(function () use ($taskKey) {
            $userKey = FileConvertConstant::getUserKey($taskKey);
            return $this->redis->get($userKey);
        }, 'verify user permission', ['task_key' => $taskKey, 'user_id' => $userId]);

        return $cachedUserId && $cachedUserId === $userId;
    }

    // ====== Lock Management ======

    /**
     * Acquire processing lock.
     */
    public function acquireLock(string $taskKey, int $ttl = FileConvertConstant::TTL_PROCESSING_LOCK): bool
    {
        try {
            return $this->locker->mutexLock($taskKey, self::LOCK_OWNER, $ttl);
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
     */
    public function releaseLock(string $taskKey): bool
    {
        try {
            return $this->locker->release($taskKey, self::LOCK_OWNER);
        } catch (Throwable $e) {
            $this->logger->error('Failed to release processing lock', [
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ====== Private Helper Methods ======

    /**
     * Get task data from cache.
     */
    private function getTaskData(string $taskKey): ?array
    {
        return $this->executeRedisOperation(function () use ($taskKey) {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            $data = $this->redis->get($cacheKey);

            if (! $data) {
                return null;
            }

            $decoded = Json::decode($data);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new RuntimeException('Failed to decode task data JSON: ' . json_last_error_msg());
            }

            return $decoded;
        }, 'get task data', ['task_key' => $taskKey]);
    }

    /**
     * Set task data to cache.
     */
    private function setTaskData(string $taskKey, array $taskData): bool
    {
        return $this->executeRedisOperation(function () use ($taskKey, $taskData) {
            $cacheKey = FileConvertConstant::getTaskKey($taskKey);
            return $this->redis->setex(
                $cacheKey,
                FileConvertConstant::TTL_TASK_STATUS,
                Json::encode($taskData)
            );
        }, 'set task data', ['task_key' => $taskKey]);
    }

    /**
     * Check if task has specific status.
     */
    private function hasTaskStatus(string $taskKey, string $status): bool
    {
        $taskData = $this->getTaskData($taskKey);
        return $taskData && $taskData['status'] === $status;
    }

    /**
     * Execute Redis operation with error handling.
     */
    private function executeRedisOperation(callable $operation, string $operationName, array $context = []): mixed
    {
        try {
            return $operation();
        } catch (Throwable $e) {
            $this->logger->error('Failed to ' . $operationName, array_merge($context, [
                'error' => $e->getMessage(),
            ]));
            return $operationName === 'get task data' || $operationName === 'get duplicate task key' ? null : false;
        }
    }
}
