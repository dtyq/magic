<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioProjectEntity;

/**
 * Audio Project Repository Interface.
 */
interface AudioProjectRepositoryInterface
{
    /**
     * Find audio project by project ID.
     */
    public function findByProjectId(int $projectId): ?AudioProjectEntity;

    /**
     * Find audio project by task key.
     */
    public function findByTaskKey(string $taskKey): ?AudioProjectEntity;

    /**
     * Find audio projects by project IDs (batch query).
     */
    public function findByProjectIds(array $projectIds): array;

    /**
     * Find audio projects by task keys with user permission validation (batch query).
     *
     * Security: JOIN with magic_super_agent_project to ensure task belongs to user.
     *
     * @param array $taskKeys Array of task keys
     * @param string $userId User ID (for permission validation)
     * @param string $orgCode Organization code (for permission validation)
     * @return array Associative array [task_key => AudioProjectEntity]
     */
    public function findByTaskKeysWithPermission(array $taskKeys, string $userId, string $orgCode): array;

    /**
     * Find audio projects with filters (paginated).
     *
     * @param string $userId User ID
     * @param string $orgCode Organization code
     * @param array $filters Filter conditions
     * @param int $page Page number
     * @param int $pageSize Page size
     * @param string $sortBy Sort by field (created_at | updated_at)
     * @param string $sortOrder Sort order (asc | desc)
     * @return array ['list' => [], 'total' => 0, 'page' => 1, 'page_size' => 20]
     */
    public function findAudioProjectsWithFilters(
        string $userId,
        string $orgCode,
        array $filters,
        int $page,
        int $pageSize,
        string $sortBy = 'updated_at',
        string $sortOrder = 'desc'
    ): array;

    /**
     * Save audio project (create or update).
     */
    public function save(AudioProjectEntity $entity): void;

    /**
     * Update audio project by project ID with partial data.
     *
     * @param int $projectId Project ID
     * @param array $data Data to update (e.g., ['tags' => [...], 'duration' => 123])
     * @return int Number of affected rows
     */
    public function updateByProjectId(int $projectId, array $data): int;

    /**
     * Delete audio project by project ID.
     */
    public function deleteByProjectId(int $projectId): void;
}
