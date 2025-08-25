<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;

interface MessageQueueRepositoryInterface
{
    /**
     * Create message queue.
     */
    public function create(MessageQueueEntity $messageQueue): MessageQueueEntity;

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
     * Get message queue by ID for specific user.
     */
    public function getByIdForUser(int $id, string $userId): ?MessageQueueEntity;

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
     * @return array{list: MessageQueueEntity[], total: int}
     */
    public function getMessagesByStatuses(
        array $conditions = [],
        array $statuses = [],
        bool $needPagination = true,
        int $pageSize = 10,
        int $page = 1
    ): array;

    /**
     * Get next pending message for consumption.
     */
    public function getNextPendingMessage(string $userId, ?int $topicId = null): ?MessageQueueEntity;

    /**
     * Update message with conditions (for status changes with concurrency control).
     */
    public function updateWithConditions(int $id, array $data, array $conditions = []): bool;
}
