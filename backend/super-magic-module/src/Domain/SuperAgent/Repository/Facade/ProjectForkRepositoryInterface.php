<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectForkEntity;

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
     * Get fork statistics by user.
     */
    public function getForkStatsByUser(string $userId): array;

    public function getForkCountByProjectId(int $projectId): int;
}
