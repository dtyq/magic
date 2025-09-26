<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;

/**
 * Message schedule repository interface.
 */
interface MessageScheduleRepositoryInterface
{
    /**
     * Find message schedule by ID.
     */
    public function findById(int $id): ?MessageScheduleEntity;

    /**
     * Save message schedule.
     */
    public function save(MessageScheduleEntity $messageSchedule): MessageScheduleEntity;

    /**
     * Create message schedule.
     */
    public function create(MessageScheduleEntity $messageSchedule): MessageScheduleEntity;

    /**
     * Delete message schedule (soft delete).
     */
    public function delete(MessageScheduleEntity $messageSchedule): bool;

    /**
     * Get message schedules by conditions with pagination and sorting.
     */
    public function getMessageSchedulesByConditions(
        array $conditions = [],
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'updated_at',
        string $orderDirection = 'desc'
    ): array;

    /**
     * Update message schedule by condition.
     */
    public function updateMessageScheduleByCondition(array $condition, array $data): bool;

    /**
     * Get message schedules by user ID.
     */
    public function getMessageSchedulesByUserId(string $userId, string $organizationCode): array;

    /**
     * Get message schedules by workspace ID.
     */
    public function getMessageSchedulesByWorkspaceId(int $workspaceId, string $userId, string $organizationCode): array;

    /**
     * Get message schedules by project ID.
     */
    public function getMessageSchedulesByProjectId(int $projectId, string $userId, string $organizationCode): array;

    /**
     * Get message schedules by topic ID.
     */
    public function getMessageSchedulesByTopicId(int $topicId, string $userId, string $organizationCode): array;

    /**
     * Find message schedule by task scheduler crontab ID.
     */
    public function findByTaskSchedulerCrontabId(int $taskSchedulerCrontabId): ?MessageScheduleEntity;

    /**
     * Get enabled message schedules for a user.
     */
    public function getEnabledMessageSchedules(string $userId, string $organizationCode): array;

    /**
     * Update task scheduler crontab ID.
     */
    public function updateTaskSchedulerCrontabId(int $id, ?int $taskSchedulerCrontabId): bool;

    /**
     * Batch update message schedules by condition.
     */
    public function batchUpdateByCondition(array $condition, array $data): int;
}
