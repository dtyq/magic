<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Constant\TopicDuplicateConstant;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * Topic duplication status manager.
 *
 * Provides unified interface for managing topic duplication processing status,
 * user permissions, and task progress tracking
 */
class TopicDuplicateStatusManager
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('TopicDuplicateStatus');
    }

    // ====== Task Lifecycle Management ======

    /**
     * Initialize a new topic duplication task.
     */
    public function initializeTask(string $taskKey, string $userId, array $taskData): bool
    {
        $fullTaskData = [
            'status' => 'running',
            'message' => 'Topic duplication started',
            'progress' => [
                'current' => 0,
                'total' => 100,
                'percentage' => 0.0,
                'message' => 'Initializing topic duplication',
            ],
            'task_data' => $taskData,
            'result' => null,
            'error' => null,
            'created_at' => time(),
            'updated_at' => time(),
        ];

        $success = $this->setTaskData($taskKey, $fullTaskData) && $this->setUserPermission($taskKey, $userId);

        if (! $success) {
            $this->logger->error('Failed to initialize topic duplication task', [
                'task_key' => $taskKey,
                'user_id' => $userId,
                'source_topic_id' => $taskData['source_topic_id'] ?? 'unknown',
            ]);
        }

        return $success;
    }

    /**
     * Update task progress.
     */
    public function setTaskProgress(string $taskKey, int $percentage, string $message = ''): bool
    {
        $taskData = $this->getTaskData($taskKey);
        if (! $taskData) {
            return false;
        }

        $taskData['progress'] = [
            'current' => $percentage,
            'total' => 100,
            'percentage' => (float) $percentage,
            'message' => $message ?: 'Topic duplication in progress',
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

        $taskData['status'] = 'completed';
        $taskData['message'] = 'Topic duplication completed successfully';
        $taskData['progress'] = [
            'current' => 100,
            'total' => 100,
            'percentage' => 100.0,
            'message' => 'Completed',
        ];
        $taskData['result'] = $result;
        $taskData['error'] = null;
        $taskData['updated_at'] = time();

        $success = $this->setTaskData($taskKey, $taskData);
        if ($success) {
            $this->logger->info('Topic duplication task completed', [
                'task_key' => $taskKey,
                'new_topic_id' => $result['topic_id'] ?? 'unknown',
            ]);
        }

        return $success;
    }

    /**
     * Mark task as failed.
     */
    public function setTaskFailed(string $taskKey, string $error): bool
    {
        $taskData = $this->getTaskData($taskKey) ?: [
            'status' => 'failed',
            'message' => 'Topic duplication failed',
            'progress' => null,
            'task_data' => [],
            'result' => null,
            'created_at' => time(),
        ];

        $taskData['status'] = 'failed';
        $taskData['message'] = 'Topic duplication failed';
        $taskData['result'] = null;
        $taskData['error'] = $error;
        $taskData['updated_at'] = time();

        $success = $this->setTaskData($taskKey, $taskData);
        if ($success) {
            $this->logger->error('Topic duplication task failed', [
                'task_key' => $taskKey,
                'source_topic_id' => $taskData['task_data']['source_topic_id'] ?? 'unknown',
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

    // ====== User Permission Management ======

    /**
     * Set user permission for task access.
     */
    public function setUserPermission(string $taskKey, string $userId, int $ttl = TopicDuplicateConstant::TTL_USER_PERMISSION): bool
    {
        return $this->executeRedisOperation(function () use ($taskKey, $userId, $ttl) {
            $userKey = TopicDuplicateConstant::getUserKey($taskKey);
            return $this->redis->setex($userKey, $ttl, $userId);
        }, 'set user permission', ['task_key' => $taskKey, 'user_id' => $userId]);
    }

    /**
     * Verify user permission for task access.
     */
    public function verifyUserPermission(string $taskKey, string $userId): bool
    {
        $cachedUserId = $this->executeRedisOperation(function () use ($taskKey) {
            $userKey = TopicDuplicateConstant::getUserKey($taskKey);
            return $this->redis->get($userKey);
        }, 'verify user permission', ['task_key' => $taskKey, 'user_id' => $userId]);

        return $cachedUserId && $cachedUserId === $userId;
    }

    // ====== Private Helper Methods ======

    /**
     * Get task data from cache.
     */
    private function getTaskData(string $taskKey): ?array
    {
        return $this->executeRedisOperation(function () use ($taskKey) {
            $cacheKey = TopicDuplicateConstant::getTaskKey($taskKey);
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
            $cacheKey = TopicDuplicateConstant::getTaskKey($taskKey);
            return $this->redis->setex(
                $cacheKey,
                TopicDuplicateConstant::TTL_TASK_STATUS,
                Json::encode($taskData)
            );
        }, 'set task data', ['task_key' => $taskKey]);
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
            return $operationName === 'get task data' ? null : false;
        }
    }
}
