<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Repository\Facade;

use App\Domain\SuperMagic\Message\Entity\MessageQueueEntity;
use App\Domain\SuperMagic\Message\Entity\ValueObject\MessageQueueStatus;

interface MessageQueueRepositoryInterface
{
    /**
     * Create message queue.
     */
    public function create(MessageQueueEntity $messageQueue): MessageQueueEntity;

    public function getByClientSyncId(string $userId, string $organizationCode, int $projectId, int $topicId, string $syncId): ?MessageQueueEntity;

    public function getNextSortOrder(int $topicId): int;

    public function restore(MessageQueueEntity $message): bool;

    /** @param int[] $messageIds */
    public function saveOrder(int $topicId, array $messageIds): void;

    /**
     * Update message queue.
     */
    public function update(MessageQueueEntity $messageQueue): bool;

    /**
     * Delete message queue (soft delete).
     */
    public function delete(int $id, string $userId): bool;

    /**
     * Get pending messages by topic ID.
     *
     * @param int $topicId Topic ID
     * @param string $userId User ID
     * @return MessageQueueEntity[]
     */
    public function getPendingMessagesByTopic(int $topicId, string $userId): array;

    /**
     * Get message queue by ID.
     */
    public function getById(int $id, bool $includeDeleted = false): ?MessageQueueEntity;

    /**
     * Get message queue by ID for specific user.
     */
    public function getByIdForUser(int $id, string $userId, bool $includeDeleted = false): ?MessageQueueEntity;

    /**
     * Update message status.
     */
    public function updateStatus(int $id, MessageQueueStatus $status, ?string $errorMessage = null): bool;

    /**
     * Get messages with status filter.
     *
     * @param array $conditions Query conditions
     * @param MessageQueueStatus[] $statuses Status array to filter
     * @param bool $needPagination Whether to use pagination
     * @param int $pageSize Page size
     * @param int $page Page number
     * @param bool $excludeDeletedTopics Whether to exclude queues under soft-deleted topics
     * @return array{list: MessageQueueEntity[], total: int}
     */
    public function getMessagesByStatuses(
        array $conditions = [],
        array $statuses = [],
        bool $needPagination = true,
        int $pageSize = 10,
        int $page = 1,
        string $orderBy = 'id',
        string $order = 'asc',
        bool $excludeDeletedTopics = false
    ): array;

    /**
     * Get next pending message for consumption.
     */
    public function getNextPendingMessage(string $userId, ?int $topicId = null): ?MessageQueueEntity;

    /**
     * Update message with conditions (for status changes with concurrency control).
     */
    public function updateWithConditions(int $id, array $data, array $conditions = []): bool;

    /**
     * Get topic IDs that have pending messages for compensation.
     * 获取有待处理消息的话题ID列表，用于补偿处理.
     *
     * @param int $limit Maximum number of topics to return
     * @param array $organizationCodes Organization codes filter (empty array means all organizations)
     * @return array Array of topic IDs
     */
    public function getCompensationTopics(int $limit, array $organizationCodes = []): array;

    /**
     * Soft delete unfinished queues by topic IDs.
     *
     * @param int[] $topicIds
     * @return int affected rows
     */
    public function cascadeDeleteUnfinishedByTopicIds(array $topicIds, string $reason): int;

    /**
     * Soft delete unfinished queues by project IDs.
     *
     * @param int[] $projectIds
     * @return int affected rows
     */
    public function cascadeDeleteUnfinishedByProjectIds(array $projectIds, string $reason): int;

    /**
     * Get earliest pending message for specific topic.
     * 获取指定话题的最早待处理消息.
     *
     * @param int $topicId Topic ID
     * @param null|string $maxExecuteTime Max execute time filter (optional, if null then no time filter applied)
     * @return null|MessageQueueEntity Earliest pending message or null if none found
     */
    public function getEarliestMessageByTopic(int $topicId, ?string $maxExecuteTime = null): ?MessageQueueEntity;

    /**
     * Delay execution time for all pending messages in a topic.
     * 延迟话题下所有待处理消息的执行时间.
     *
     * @param int $topicId Topic ID
     * @param int $delayMinutes Delay time in minutes
     * @return bool True if any messages were updated, false otherwise
     */
    public function delayTopicMessages(int $topicId, int $delayMinutes): bool;

    /**
     * Get the IN_PROGRESS message for a specific topic (idempotency check).
     * 获取指定话题下处于 IN_PROGRESS 状态的消息，用于幂等性检查.
     *
     * @param int $topicId Topic ID
     * @return null|MessageQueueEntity IN_PROGRESS message or null
     */
    public function getInProgressMessageByTopic(int $topicId): ?MessageQueueEntity;
}
