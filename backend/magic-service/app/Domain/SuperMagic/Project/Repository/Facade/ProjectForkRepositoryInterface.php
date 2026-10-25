<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Repository\Facade;

use App\Domain\SuperMagic\Project\Entity\ProjectForkEntity;

/**
 * Project fork repository interface.
 */
interface ProjectForkRepositoryInterface
{
    /**
     * Create a new project fork record.
     */
    public function create(ProjectForkEntity $projectFork): ProjectForkEntity;

    /**
     * Save project fork entity.
     */
    public function save(ProjectForkEntity $projectFork): ProjectForkEntity;

    /**
     * Find project fork by ID.
     */
    public function findById(int $id): ?ProjectForkEntity;

    /**
     * Find project fork by user and source project.
     */
    public function findByUserAndProject(string $userId, int $sourceProjectId): ?ProjectForkEntity;

    /**
     * Find project fork by fork project ID.
     */
    public function findByForkProjectId(int $forkProjectId): ?ProjectForkEntity;

    /**
     * Update fork status and progress.
     */
    public function updateStatus(int $id, string $status, int $progress, ?string $errMsg = null): bool;

    /**
     * Update current processing file ID.
     */
    public function updateCurrentFileId(int $id, ?int $currentFileId): bool;

    /**
     * Update processed files count and progress.
     */
    public function updateProgress(int $id, int $processedFiles, int $progress): bool;

    /**
     * Update total files count (progress denominator).
     */
    public function updateTotalFiles(int $id, int $totalFiles): bool;

    /**
     * Get fork records by user ID with pagination.
     */
    public function getForksByUser(
        string $userId,
        int $page = 1,
        int $pageSize = 10,
        string $orderBy = 'created_at',
        string $orderDirection = 'desc'
    ): array;

    /**
     * Get running forks by user.
     */
    public function getRunningForksByUser(string $userId): array;

    /**
     * Delete project fork record.
     */
    public function delete(ProjectForkEntity $projectFork): bool;

    /**
     * Check if user has running fork for specific project.
     */
    public function hasRunningFork(string $userId, int $sourceProjectId): bool;

    /**
     * Fail the running forks of a source project that stopped progressing.
     *
     * The update is conditional, so concurrent callers cannot both reclaim the same record.
     * Progress is left untouched to keep however far the abandoned migration got.
     *
     * @param string $staleBefore Records not updated since this timestamp are considered abandoned
     * @return bool Whether at least one record was reclaimed
     */
    public function failStaleRunningForks(
        string $userId,
        int $sourceProjectId,
        string $staleBefore,
        string $errMsg
    ): bool;

    /**
     * Get fork statistics by user.
     */
    public function getForkStatsByUser(string $userId): array;

    /**
     * Get fork count by project ID.
     */
    public function getForkCountByProjectId(int $projectId): int;

    /**
     * Batch get fork counts by project IDs.
     *
     * @param array<int> $projectIds 项目ID数组
     * @param bool $includeDeletedProjects 是否包含已删除项目的复制记录，默认false（不包含）
     * @return array<int, int> [project_id => fork_count] 映射数组
     */
    public function getForkCountsByProjectIds(array $projectIds, bool $includeDeletedProjects = false): array;
}
