<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Message\Repository\Facade;

use App\Domain\SuperMagic\Message\Entity\MessageScheduleEntity;

/**
 * Message schedule repository interface.
 */
interface MessageScheduleRepositoryInterface
{
    /**
     * Find message schedule by ID.
     */
    public function findById(int $id): ?MessageScheduleEntity;

    /** @return MessageScheduleEntity[] */
    public function getCleanupCandidates(int $afterId, int $limit, ?string $organizationCode = null, array $projectIds = []): array;

    public function findByIdForCleanup(int $id): ?MessageScheduleEntity;

    public function isProjectAvailableForCleanup(int $projectId): bool;

    public function markDeletedForCleanup(int $id, string $updatedUid): void;

    public function findByIdForUpdate(int $id): ?MessageScheduleEntity;

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
        string $orderDirection = 'desc',
        array $selectFields = []
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

    /**
     * Batch update message schedule owner and workspace by project IDs.
     */
    public function batchUpdateOwnerAndWorkspaceByProjectIds(
        array $projectIds,
        string $fromUserId,
        string $toUserId,
        string $organizationCode,
        int $workspaceId,
        string $updatedUid,
        string $updatedAt
    ): int;

    /**
     * Batch update message schedule workspace by project IDs.
     */
    public function batchUpdateWorkspaceByProjectIds(
        array $projectIds,
        string $userId,
        string $organizationCode,
        int $workspaceId,
        string $updatedUid,
        string $updatedAt
    ): int;
}
