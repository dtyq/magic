<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Service;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageQueueStatus;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageQueueWriteResult;
use App\Domain\SuperMagic\Message\Repository\Facade\MessageQueueRepositoryInterface;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Exception;
use Hyperf\DbConnection\Db;
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
        ChatMessageType $messageType
    ): MessageQueueWriteResult {
        $lockKey = $this->getTopicLockKey($topicId);

        return $this->executeWithLock($lockKey, function () use ($dataIsolation, $projectId, $topicId, $messageContent, $messageType) {
            // 首次创建标识由服务端在恢复时保留，不能由新建请求指定其他消息的来源。
            unset($messageContent['extra']['super_agent']['client_queue_create_sync_id']);
            $syncId = $messageContent['extra']['super_agent']['client_queue_sync_id'] ?? '';
            if (is_string($syncId) && $syncId !== '') {
                $existing = $this->messageQueueRepository->getByClientSyncId(
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $projectId,
                    $topicId,
                    $syncId
                );
                if ($existing) {
                    return new MessageQueueWriteResult($existing, false);
                }
            }
            // Convert array message content to JSON string with Chinese support
            $messageContentJson = json_encode($messageContent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            // Calculate expected execute time (current time + 5 minutes)
            $exceptExecuteTime = date('Y-m-d H:i:s', time() + 300); // 300 seconds = 5 minutes

            // Create message entity
            $entity = new MessageQueueEntity();
            $entity->setId(IdGenerator::getSnowId())
                ->setSortOrder($this->messageQueueRepository->getNextSortOrder($topicId))
                ->setUserId($dataIsolation->getCurrentUserId())
                ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
                ->setProjectId($projectId)
                ->setTopicId($topicId)
                ->setMessageContent($messageContentJson)
                ->setMessageType($messageType->value)
                ->setStatus(MessageQueueStatus::PENDING)
                ->setExceptExecuteTime($exceptExecuteTime)
                ->setCreatedAt(date('Y-m-d H:i:s'))
                ->setUpdatedAt(date('Y-m-d H:i:s'));

            return new MessageQueueWriteResult($this->messageQueueRepository->create($entity), true);
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

            $this->assertMessageScope($entity, $dataIsolation);
            if ($entity->getTopicId() !== $topicId || $entity->getProjectId() !== $projectId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
            }

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
    public function deleteMessage(DataIsolation $dataIsolation, int $messageId, ?string $expectedSyncId = null): bool
    {
        // Verify access permission
        $entity = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId(), true);
        $lockKey = $this->getTopicLockKey($entity->getTopicId());

        return $this->executeWithLock($lockKey, function () use ($messageId, $dataIsolation, $expectedSyncId) {
            // Check if message can be deleted (same rule as modification)
            $current = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId(), true);
            $this->assertMessageScope($current, $dataIsolation);
            // 恢复沿用原 ID；旧删除请求不能撤下后来重新入队的版本。
            $syncId = $current->getMessageContentAsArray()['extra']['super_agent']['client_queue_sync_id'] ?? '';
            if ($current->getStatus() !== MessageQueueStatus::PENDING
                || ($expectedSyncId !== null && $expectedSyncId !== $syncId)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE, trans('message_queue.status_not_modifiable'));
            }
            if ($current->getDeletedAt() !== null) {
                return false;
            }
            if (! $this->messageQueueRepository->delete($messageId, $dataIsolation->getCurrentUserId())) {
                ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE, trans('message_queue.status_not_modifiable'));
            }
            return true;
        });
    }

    public function restoreMessage(
        DataIsolation $dataIsolation,
        int $messageId,
        int $projectId,
        int $topicId,
        array $messageContent,
        ChatMessageType $messageType,
        ?int $beforeId,
        ?int $afterId,
        int $originalIndex,
        string $expectedSyncId
    ): ?MessageQueueWriteResult {
        return $this->executeWithLock($this->getTopicLockKey($topicId), function () use (
            $dataIsolation,
            $messageId,
            $projectId,
            $topicId,
            $messageContent,
            $messageType,
            $beforeId,
            $afterId,
            $originalIndex,
            $expectedSyncId
        ) {
            return Db::transaction(function () use (
                $dataIsolation,
                $messageId,
                $projectId,
                $topicId,
                $messageContent,
                $messageType,
                $beforeId,
                $afterId,
                $originalIndex,
                $expectedSyncId
            ) {
                $message = $this->messageQueueRepository->getById($messageId, true);
                if (! $message) {
                    return null;
                }
                $this->assertMessageScope($message, $dataIsolation);
                if ($message->getProjectId() !== $projectId || $message->getTopicId() !== $topicId) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
                }
                $syncId = $messageContent['extra']['super_agent']['client_queue_sync_id'] ?? '';
                $currentExtra = $message->getMessageContentAsArray()['extra']['super_agent'] ?? [];
                $currentSyncId = $currentExtra['client_queue_sync_id'] ?? '';
                // 同一提交即使已经消费也只返回受理结果，不再次恢复或覆盖内容。
                if ($syncId !== '' && $syncId === $currentSyncId) {
                    return new MessageQueueWriteResult($message, false);
                }
                if ($message->getDeletedAt() === null || $message->getStatus() !== MessageQueueStatus::PENDING
                    || $expectedSyncId !== $currentSyncId) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE, trans('message_queue.status_not_modifiable'));
                }
                $ids = $this->positionMessage($message, $beforeId, $afterId, $originalIndex);
                // 创建请求 A → 编辑恢复 B → A 的迟到重试：仍须找到同一条记录。
                // 当前标识用于本次恢复和旧删除校验；首次创建标识只保留一次，不积累历史列表。
                $messageContent['extra']['super_agent']['client_queue_create_sync_id']
                    = $currentExtra['client_queue_create_sync_id'] ?? $currentSyncId;
                $message->setMessageContent(json_encode($messageContent, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR))
                    ->setMessageType($messageType->value);
                if (! $this->messageQueueRepository->restore($message)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE, trans('message_queue.status_not_modifiable'));
                }
                $this->messageQueueRepository->saveOrder($topicId, $ids);
                return new MessageQueueWriteResult($this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId()), true);
            });
        });
    }

    public function moveMessage(DataIsolation $dataIsolation, int $messageId, ?int $beforeId, ?int $afterId): MessageQueueEntity
    {
        $message = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());
        return $this->executeWithLock($this->getTopicLockKey($message->getTopicId()), function () use ($dataIsolation, $messageId, $beforeId, $afterId) {
            return Db::transaction(function () use ($dataIsolation, $messageId, $beforeId, $afterId) {
                $message = $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());
                $this->assertMessageScope($message, $dataIsolation);
                if ($message->getStatus() !== MessageQueueStatus::PENDING) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::MESSAGE_STATUS_NOT_MODIFIABLE, trans('message_queue.status_not_modifiable'));
                }
                $ids = $this->positionMessage($message, $beforeId, $afterId, null);
                $this->messageQueueRepository->saveOrder($message->getTopicId(), $ids);
                return $this->getMessageForUser($messageId, $dataIsolation->getCurrentUserId());
            });
        });
    }

    public function tryStartProcessing(int $messageId): bool
    {
        return $this->messageQueueRepository->updateWithConditions(
            $messageId,
            ['status' => MessageQueueStatus::IN_PROGRESS->value, 'execute_time' => date('Y-m-d H:i:s')],
            ['status' => MessageQueueStatus::PENDING->value]
        );
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
        $conditions['organization_code'] = $dataIsolation->getCurrentOrganizationCode();

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
            $page,
            'sort_order',
            'asc',
            true
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
        return $this->messageQueueRepository->updateStatus(
            $messageId,
            $status,
            $this->normalizeErrorMessage($errorMessage)
        );
    }

    /**
     * Get message by ID without user permission check.
     * Used for internal processing where permission is already validated.
     */
    public function getMessageById(int $messageId): ?MessageQueueEntity
    {
        return $this->messageQueueRepository->getById($messageId);
    }

    /**
     * Get message for specific user with permission check.
     */
    public function getMessageForUser(int $messageId, string $userId, bool $includeDeleted = false): MessageQueueEntity
    {
        $entity = $this->messageQueueRepository->getByIdForUser($messageId, $userId, $includeDeleted);

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

    public function cascadeDeleteUnfinishedByTopicIds(array $topicIds, string $reason): int
    {
        $topicIds = $this->normalizeIds($topicIds);
        if (empty($topicIds)) {
            return 0;
        }

        return $this->messageQueueRepository->cascadeDeleteUnfinishedByTopicIds(
            $topicIds,
            $this->normalizeReason($reason)
        );
    }

    public function cascadeDeleteUnfinishedByProjectIds(array $projectIds, string $reason): int
    {
        $projectIds = $this->normalizeIds($projectIds);
        if (empty($projectIds)) {
            return 0;
        }

        return $this->messageQueueRepository->cascadeDeleteUnfinishedByProjectIds(
            $projectIds,
            $this->normalizeReason($reason)
        );
    }

    /**
     * Get earliest pending message for specific topic.
     * 获取指定话题的最早待处理消息.
     *
     * @param int $topicId Topic ID
     * @param null|string $maxExecuteTime Max execute time filter (optional, if null then no time filter applied)
     */
    public function getEarliestMessageByTopic(int $topicId, ?string $maxExecuteTime = null): ?MessageQueueEntity
    {
        return $this->messageQueueRepository->getEarliestMessageByTopic($topicId, $maxExecuteTime);
    }

    /**
     * Get IN_PROGRESS message for specific topic (idempotency check).
     * 获取指定话题下处于 IN_PROGRESS 状态的消息，用于幂等性检查.
     */
    public function getInProgressMessageByTopic(int $topicId): ?MessageQueueEntity
    {
        return $this->messageQueueRepository->getInProgressMessageByTopic($topicId);
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
        return $this->messageQueueRepository->updateStatus(
            $messageId,
            $status,
            $this->normalizeErrorMessage($errorMessage)
        );
    }

    /** @return int[] 只移动当前项，其他消息以锁内的真实顺序为准。 */
    private function positionMessage(MessageQueueEntity $message, ?int $beforeId, ?int $afterId, ?int $originalIndex): array
    {
        foreach ([$beforeId, $afterId] as $anchorId) {
            if ($anchorId === null) {
                continue;
            }
            $anchor = $this->messageQueueRepository->getById($anchorId, true);
            if ($anchorId === $message->getId() || ($anchor && (
                $anchor->getTopicId() !== $message->getTopicId()
                || $anchor->getUserId() !== $message->getUserId()
                || $anchor->getOrganizationCode() !== $message->getOrganizationCode()
            ))) {
                ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, trans('message_queue.queue_changed'));
            }
        }
        $pending = $this->messageQueueRepository->getPendingMessagesByTopic($message->getTopicId(), $message->getUserId());
        $ids = array_values(array_filter(
            array_map(static fn (MessageQueueEntity $item): int => $item->getId(), $pending),
            static fn (int $id): bool => $id !== $message->getId()
        ));
        $beforeIndex = array_search($beforeId, $ids, true);
        $afterIndex = array_search($afterId, $ids, true);
        // 原后邻项优先；编辑期间邻项被消费后，才按原序号尽量恢复。
        if ($beforeIndex !== false) {
            $index = $beforeIndex;
        } elseif ($afterIndex !== false) {
            $index = $afterIndex + 1;
        } elseif ($originalIndex !== null) {
            $index = min($originalIndex, count($ids));
        } elseif ($ids === [] && $beforeId === null && $afterId === null) {
            $index = 0;
        } else {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, trans('message_queue.queue_changed'));
        }
        array_splice($ids, $index, 0, [$message->getId()]);
        return $ids;
    }

    private function assertMessageScope(MessageQueueEntity $message, DataIsolation $dataIsolation): void
    {
        if ($message->getUserId() !== $dataIsolation->getCurrentUserId()
            || $message->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_ACCESS_DENIED, 'topic.topic_access_denied');
        }
    }

    /**
     * Domain rule: Limit error message length to prevent database issues.
     */
    private function normalizeErrorMessage(?string $errorMessage): ?string
    {
        if ($errorMessage !== null && mb_strlen($errorMessage) > 500) {
            return mb_substr($errorMessage, 0, 497) . '...';
        }

        return $errorMessage;
    }

    /**
     * @return int[]
     */
    private function normalizeIds(array $ids): array
    {
        $normalizedIds = [];
        foreach ($ids as $id) {
            $id = (int) $id;
            if ($id > 0 && ! in_array($id, $normalizedIds, true)) {
                $normalizedIds[] = $id;
            }
        }

        return $normalizedIds;
    }

    private function normalizeReason(string $reason): string
    {
        if (mb_strlen($reason) > 500) {
            return mb_substr($reason, 0, 497) . '...';
        }

        return $reason;
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
