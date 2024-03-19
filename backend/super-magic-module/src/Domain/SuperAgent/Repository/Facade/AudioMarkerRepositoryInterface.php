<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioMarkerEntity;

interface AudioMarkerRepositoryInterface
{
    /**
     * Create audio marker.
     */
    public function create(AudioMarkerEntity $entity): AudioMarkerEntity;

    /**
     * Update audio marker.
     */
    public function update(AudioMarkerEntity $entity): bool;

    /**
     * Get audio marker by ID.
     */
    public function getById(int $id): ?AudioMarkerEntity;

    /**
     * Get audio markers by project ID with pagination.
     */
    public function getByProjectId(
        int $projectId,
        int $page = 1,
        int $pageSize = 20,
        string $orderBy = 'position_seconds',
        string $orderDirection = 'asc'
    ): array;

    /**
     * Get audio markers by project ID and user ID with pagination (for private markers).
     */
    public function getByProjectIdAndUserId(
        int $projectId,
        string $userId,
        int $page = 1,
        int $pageSize = 20,
        string $orderBy = 'position_seconds',
        string $orderDirection = 'asc'
    ): array;

    /**
     * Delete audio marker (soft delete).
     */
    public function delete(int $id): bool;

    /**
     * Save audio marker (create or update).
     */
    public function save(AudioMarkerEntity $entity): AudioMarkerEntity;
}
