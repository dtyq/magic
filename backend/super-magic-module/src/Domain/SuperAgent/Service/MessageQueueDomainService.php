<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageQueueRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\trans;

class MessageQueueDomainService
{
    // Unified topic lock prefix - consistent with compensation service
    private const TOPIC_LOCK_PREFIX = 'msg_queue_compensation:topic:';

    private const LOCK_TIMEOUT = 10; // seconds

    protected LoggerInterface $logger;

    public function __construct(
        protected MessageQueueRepositoryInterface $messageQueueRepository,
        protected LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Create message queue with lock protection.
     */
    public function createMessage(
        DataIsolation $dataIsolation,
        int $projectId,
        int $topicId,
        array $messageContent,
        string $messageType
    ): MessageQueueEntity {
        $lockKey = $this->getTopicLockKey($topicId);

        return $this->executeWithLock($lockKey, function () use ($dataIsolation, $projectId, $topicId, $messageContent, $messageType) {
            // Convert array message content to JSON string with Chinese support
            $messageContentJson = json_encode($messageContent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            // Calculate expected execute time (current time + 5 minutes)
            $exceptExecuteTime = date('Y-m-d H:i:s', time() + 300); // 300 seconds = 5 minutes

            // Create message entity
            $entity = new MessageQueueEntity();
            $entity->setId(IdGenerator::getSnowId())
                ->setUserId($dataIsolation->getCurrentUserId())
                ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
                ->setProjectId($projectId)
                ->setTopicId($topicId)
                ->setMessageContent($messageContentJson)
                ->setMessageType($messageType)
                ->setStatus(MessageQueueStatus::PENDING)
                ->setExceptExecuteTime($exceptExecuteTime)
                ->setCreatedAt(date('Y-m-d H:i:s'))
                ->setUpdatedAt(date('Y-m-d H:i:s'));

            return $this->messageQueueRepository->create($entity);
        });
    }

    /**
     * Update message queue with lock protection.
     */
    public function updateMessage(
        DataIsolation $dataIsolation,
        int $messageId,
        int $projectId,
        int $topicId,
        array $messageContent,
        string $messageType
    ): MessageQueueEntity {
        $lockKey = $this->getTopicLockKey($topicId);

        return $this->executeWithLock($lockKey, function () use ($dataIsolation, $messageId, $projectId, $topicId, $messageContent, $messageType) {
            // Get existing message
            $entity = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());

            // Check if message can be modified
            if (! $entity->canBeModified()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE,
                    trans('message_queue.status_not_modifiable')
                );
            }

            // Convert array message content to JSON string with Chinese support
            $messageContentJson = json_encode($messageContent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            // Update message content (do not modify except_execute_time during update)
            $entity->setProjectId($projectId)
                ->setTopicId($topicId)
                ->setMessageContent($messageContentJson)
                ->setMessageType($messageType)
                ->setUpdatedAt(date('Y-m-d H:i:s'));

            if (! $this->messageQueueRepository->update($entity)) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::VALIDATE_FAILED,
                    'message_queue.update_failed'
                );
            }

            return $entity;
        });
    }

    /**
     * Delete message queue.
     */
    public function deleteMessage(DataIsolation $dataIsolation, int $messageId): bool
    {
        // Verify access permission
        $entity = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());

        // Check if message can be deleted (same rule as modification)
        if (! $entity->canBeModified()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE,
                trans('message_queue.status_not_modifiable')
            );
        }

        $lockKey = $this->getTopicLockKey($entity->getTopicId());

        return $this->executeWithLock($lockKey, function () use ($messageId, $dataIsolation) {
            return $this->messageQueueRepository->delete($messageId, $dataIsolation->getCurrentUserId());
        });
    }

    /**
     * Query message queues by conditions.
     */
    public function queryMessages(
        DataIsolation $dataIsolation,
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10
    ): array {
        // Add user filter to conditions
        $conditions['user_id'] = $dataIsolation->getCurrentUserId();

        // Default to filter out completed messages
        if (! isset($conditions['status'])) {
            $conditions['status'] = [
                MessageQueueStatus::PENDING->value,
                MessageQueueStatus::IN_PROGRESS->value,
                MessageQueueStatus::FAILED->value,
            ];
        }

        return $this->messageQueueRepository->getMessagesByStatuses(
            $conditions,
            [],
            true,
            $pageSize,
            $page
        );
    }

    /**
     * Consume message queue.
     */
    public function consumeMessage(DataIsolation $dataIsolation, int $messageId): MessageQueueEntity
    {
        // Get message and verify access
        $entity = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());

        // Check if message can be consumed
        if (! $entity->canBeConsumed()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::VALIDATE_FAILED,
                'message_queue.cannot_consume_message'
            );
        }

        $lockKey = $this->getTopicLockKey($entity->getTopicId());

        return $this->executeWithLock($lockKey, function () use ($entity) {
            // Mark as in progress with optimistic locking
            $success = $this->messageQueueRepository->updateWithConditions(
                $entity->getId(),
                [
                    'status' => MessageQueueStatus::COMPLETED->value,
                    'execute_time' => date('Y-m-d H:i:s'),
                ],
                ['status' => MessageQueueStatus::PENDING->value] // Only update if still pending
            );

            if (! $success) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::VALIDATE_FAILED,
                    'message_queue.consume_failed'
                );
            }

            // Update entity status
            $entity->markAsCompleted();
            return $entity;
        });
    }

    /**
     * Get pending messages for topic.
     */
    public function getPendingMessages(DataIsolation $dataIsolation, int $topicId): array
    {
        return $this->messageQueueRepository->getPendingMessagesByTopic(
            $topicId,
            $dataIsolation->getCurrentUserId()
        );
    }

    /**
     * Get next pending message for consumption.
     */
    public function getNextPendingMessage(DataIsolation $dataIsolation, ?int $topicId = null): ?MessageQueueEntity
    {
        return $this->messageQueueRepository->getNextPendingMessage(
            $dataIsolation->getCurrentUserId(),
            $topicId
        );
    }

    /**
     * Update message status by message ID.
     */
    public function updateMessageStatus(
        int $messageId,
        MessageQueueStatus $status,
        ?string $errorMessage = null
    ): bool {
        // Domain rule: Limit error message length to prevent database issues
        if ($errorMessage !== null && mb_strlen($errorMessage) > 500) {
            $errorMessage = mb_substr($errorMessage, 0, 497) . '...';
        }

        return $this->messageQueueRepository->updateStatus($messageId, $status, $errorMessage);
    }

    /**
     * Get message for specific user with permission check.
     */
    public function getMessageForUser(int $messageId, string $userId): MessageQueueEntity
    {
        $entity = $this->messageQueueRepository->getByIdForUser($messageId, $userId);

        if (! $entity) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::VALIDATE_FAILED,
                'message_queue.message_not_found'
            );
        }

        return $entity;
    }

    /**
     * Acquire topic-level mutex lock.
     * 获取话题级互斥锁.
     */
    public function acquireTopicLock(int $topicId, int $lockTimeout = 300): ?string
    {
        $lockKey = $this->getTopicLockKey($topicId);
        $lockOwner = IdGenerator::getUniqueId32();

        $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, $lockTimeout);

        if (! $lockAcquired) {
            return null; // Lock acquisition failed
        }

        return $lockOwner; // Return lock owner for later release
    }

    /**
     * Release topic-level mutex lock.
     * 释放话题级互斥锁.
     */
    public function releaseTopicLock(int $topicId, string $lockOwner): bool
    {
        $lockKey = $this->getTopicLockKey($topicId);
        return $this->locker->release($lockKey, $lockOwner);
    }

    /**
     * Get topic IDs that have pending messages for compensation.
     * 获取有待处理消息的话题ID列表，用于补偿处理.
     */
    public function getCompensationTopics(int $limit = 50, array $organizationCodes = []): array
    {
        return $this->messageQueueRepository->getCompensationTopics($limit, $organizationCodes);
    }

    /**
     * Get earliest pending message for specific topic.
     * 获取指定话题的最早待处理消息.
     */
    public function getEarliestMessageByTopic(int $topicId): ?MessageQueueEntity
    {
        return $this->messageQueueRepository->getEarliestMessageByTopic($topicId);
    }

    /**
     * Delay execution time for all pending messages in a topic.
     * 延迟话题下所有待处理消息的执行时间.
     */
    public function delayTopicMessages(int $topicId, int $delayMinutes): bool
    {
        return $this->messageQueueRepository->delayTopicMessages($topicId, $delayMinutes);
    }

    /**
     * Update message status by message ID.
     * 更新消息状态（补偿机制专用，简化版本）.
     */
    public function updateStatus(int $messageId, MessageQueueStatus $status, ?string $errorMessage = null): bool
    {
        // Domain rule: Limit error message length to prevent database issues
        if ($errorMessage !== null && mb_strlen($errorMessage) > 500) {
            $errorMessage = mb_substr($errorMessage, 0, 497) . '...';
        }

        return $this->messageQueueRepository->updateStatus($messageId, $status, $errorMessage);
    }

    /**
     * Execute operation with distributed mutex lock.
     */
    private function executeWithLock(string $lockKey, callable $callback): mixed
    {
        $lockOwner = IdGenerator::getUniqueId32();
        $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, self::LOCK_TIMEOUT);

        if (! $lockAcquired) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::TOPIC_LOCK_FAILED,
                trans('message_queue.operation_locked')
            );
        }

        try {
            // Execute the callback
            return $callback();
        } catch (Exception $e) {
            $this->logger->error('MessageQueue operation failed', [
                'lock_key' => $lockKey,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        } finally {
            // Always release the lock
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    /**
     * Generate unified topic lock key - consistent with compensation service.
     * 生成统一的话题锁Key，与补偿服务保持一致.
     */
    private function getTopicLockKey(int $topicId): string
    {
        return self::TOPIC_LOCK_PREFIX . $topicId;
    }
}
