<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\MessageQueueRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Redis\Redis;

use function Hyperf\Translation\trans;

class MessageQueueDomainService
{
    private const LOCK_PREFIX = 'message_queue_lock:';

    private const LOCK_TIMEOUT = 10; // seconds

    public function __construct(
        protected MessageQueueRepositoryInterface $messageQueueRepository,
        protected Redis $redis,
        protected StdoutLoggerInterface $logger,
    ) {
    }

    /**
     * Create message queue with lock protection.
     */
    public function createMessage(
        DataIsolation $dataIsolation,
        int $projectId,
        int $topicId,
        string $messageContent
    ): MessageQueueEntity {
        $lockKey = $this->getLockKey('create', $topicId, $dataIsolation->getCurrentUserId());

        return $this->executeWithLock($lockKey, function () use ($dataIsolation, $projectId, $topicId, $messageContent) {
            // Create message entity
            $entity = new MessageQueueEntity();
            $entity->setId(IdGenerator::getSnowId())
                ->setUserId($dataIsolation->getCurrentUserId())
                ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
                ->setProjectId($projectId)
                ->setTopicId($topicId)
                ->setMessageContent($messageContent)
                ->setStatus(MessageQueueStatus::PENDING)
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
        string $messageContent
    ): MessageQueueEntity {
        $lockKey = $this->getLockKey('update', $topicId, $dataIsolation->getCurrentUserId());

        return $this->executeWithLock($lockKey, function () use ($dataIsolation, $messageId, $projectId, $topicId, $messageContent) {
            // Get existing message
            $entity = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());

            // Check if message can be modified
            if (! $entity->canBeModified()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE,
                    trans('message_queue.status_not_modifiable')
                );
            }

            // Update message content
            $entity->setProjectId($projectId)
                ->setTopicId($topicId)
                ->setMessageContent($messageContent)
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

        $lockKey = $this->getLockKey('delete', $entity->getTopicId(), $dataIsolation->getCurrentUserId());

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

        $lockKey = $this->getLockKey('consume', $entity->getTopicId(), $dataIsolation->getCurrentUserId());

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
     * Execute operation with distributed lock.
     */
    private function executeWithLock(string $lockKey, callable $callback): mixed
    {
        $lockAcquired = false;

        try {
            // Try to acquire lock
            $lockAcquired = $this->redis->set(
                $lockKey,
                time(),
                ['nx', 'ex' => self::LOCK_TIMEOUT]
            );

            if (! $lockAcquired) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::TOPIC_LOCK_FAILED,
                    'message_queue.operation_locked'
                );
            }

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
            if ($lockAcquired) {
                $this->redis->del($lockKey);
            }
        }
    }

    /**
     * Generate lock key for different operations.
     */
    private function getLockKey(string $operation, int $topicId, string $userId): string
    {
        return self::LOCK_PREFIX . $operation . ':' . $topicId . ':' . md5($userId);
    }
}
