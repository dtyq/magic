<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\AudioProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;

/**
 * Audio Project Domain Service (Business Logic Only).
 *
 * Responsibilities:
 * - Manage business data (duration, fileSize, audioSource, audioFileId, tags, etc.)
 * - Handle special business logic (updateHiddenStatus, topic/model updates)
 * - NO phase state management (delegated to AsrTaskDomainService)
 * - NO inter-domain service calls
 */
class AudioProjectDomainService
{
    public function __construct(
        private AudioProjectRepositoryInterface $audioProjectRepository,
        private ProjectRepositoryInterface $projectRepository
    ) {
    }

    /**
     * Create audio project extension.
     */
    public function createAudioProject(
        int $projectId,
        string $source,
        ?string $deviceId = null,
        bool $autoSummary = true,
        ?string $taskKey = null,
        ?string $modelId = null,
        ?int $topicId = null,
        string $audioSource = 'recorded'
    ): AudioProjectEntity {
        $entity = new AudioProjectEntity();
        $entity->setProjectId($projectId);
        $entity->setSource($source);
        $entity->setDeviceId($deviceId);
        $entity->setTags([]);
        $entity->setAutoSummary($autoSummary);
        $entity->setTaskKey($taskKey);
        $entity->setModelId($modelId);
        $entity->setTopicId($topicId);
        $entity->setAudioSource($audioSource);

        // Set default phase fields (initial state)
        $entity->setCurrentPhase('waiting');
        $entity->setPhaseStatus(null);
        $entity->setPhasePercent(0);
        $entity->setPhaseError(null);

        $this->audioProjectRepository->save($entity);

        return $entity;
    }

    /**
     * Get audio project by project ID.
     */
    public function getAudioProjectByProjectId(int $projectId): ?AudioProjectEntity
    {
        return $this->audioProjectRepository->findByProjectId($projectId);
    }

    /**
     * Get audio project by task key.
     */
    public function getAudioProjectByTaskKey(string $taskKey): ?AudioProjectEntity
    {
        return $this->audioProjectRepository->findByTaskKey($taskKey);
    }

    /**
     * Get audio projects by project IDs (batch).
     */
    public function getAudioProjectsByProjectIds(array $projectIds): array
    {
        return $this->audioProjectRepository->findByProjectIds($projectIds);
    }

    // ========== Business Logic Methods (Extracted from *IfExists) ==========

    /**
     * Show project if it exists (make it visible in UI).
     *
     * Business Logic: Update project hidden status to false.
     * Extracted from: startMergingPhaseIfExists()
     *
     * @param int $projectId Project ID
     * @return bool Returns true if project exists and updated, false if not exists
     */
    public function showProjectIfExists(int $projectId): bool
    {
        $audioProject = $this->getAudioProjectByProjectId($projectId);
        if ($audioProject === null) {
            return false;
        }

        // Update project hidden status is false (show in UI)
        $this->projectRepository->updateHiddenStatus($projectId, false);

        return true;
    }

    /**
     * Update recording metadata (duration, fileSize, audioSource, audioFileId).
     *
     * Business Logic: Update audio file metadata after merging.
     * Extracted from: completeMergingPhaseIfExists()
     *
     * @param int $projectId Project ID
     * @param null|int $duration Audio duration (seconds)
     * @param null|int $fileSize File size (bytes)
     * @param null|string $audioSource Audio source (recorded/imported)
     * @param null|int $audioFileId Audio file ID
     * @return bool Returns true if project exists and updated, false if not exists
     */
    public function updateRecordingMetadata(
        int $projectId,
        ?int $duration = null,
        ?int $fileSize = null,
        ?string $audioSource = null,
        ?int $audioFileId = null
    ): bool {
        $audioProject = $this->getAudioProjectByProjectId($projectId);

        if ($audioProject === null) {
            return false;
        }

        // Update audio metadata if provided
        if ($duration !== null) {
            $audioProject->setDuration($duration);
        }
        if ($fileSize !== null) {
            $audioProject->setFileSize($fileSize);
        }
        if ($audioSource !== null) {
            $audioProject->setAudioSource($audioSource);
        }
        if ($audioFileId !== null) {
            $audioProject->setAudioFileId($audioFileId);
        }

        $this->save($audioProject);

        return true;
    }

    /**
     * Update topic and model configuration.
     *
     * Business Logic: Update AI task configuration (topic and model).
     * Extracted from: startSummarizingPhaseIfExists()
     *
     * @param int $projectId Project ID
     * @param null|int $topicId Topic ID (optional)
     * @param null|string $modelId Model ID (optional)
     * @return bool Returns true if project exists and updated, false if not exists
     */
    public function updateTopicAndModel(
        int $projectId,
        ?int $topicId = null,
        ?string $modelId = null
    ): bool {
        $audioProject = $this->getAudioProjectByProjectId($projectId);

        if ($audioProject === null) {
            return false;
        }

        // Update config if provided
        if ($topicId !== null) {
            $audioProject->setTopicId($topicId);
        }
        if ($modelId !== null) {
            $audioProject->setModelId($modelId);
        }

        $this->save($audioProject);

        return true;
    }

    // ========== Legacy Methods (Kept for Compatibility) ==========

    /**
     * Update recording duration and file size.
     */
    public function updateRecordingDuration(
        AudioProjectEntity $audioProject,
        int $duration,
        int $fileSize
    ): void {
        $audioProject->setDuration($duration);
        $audioProject->setFileSize($fileSize);
        $this->audioProjectRepository->save($audioProject);
    }

    /**
     * Update tags by project ID.
     *
     * @param int $projectId Project ID
     * @param array $tags Tags array
     * @return bool Returns true if project exists and updated, false if not exists
     */
    public function updateTags(int $projectId, array $tags): bool
    {
        $audioProject = $this->getAudioProjectByProjectId($projectId);

        if ($audioProject === null) {
            return false;
        }

        $audioProject->setTags($tags);
        $this->save($audioProject);

        return true;
    }

    /**
     * Get audio projects with filters (for list queries).
     *
     * This method encapsulates query logic in the domain layer,
     * following DDD principles: Application Layer → Domain Layer → Repository.
     */
    public function getAudioProjectsWithFilters(
        string $userId,
        string $orgCode,
        array $filters,
        int $page,
        int $pageSize,
        string $sortBy = 'updated_at',
        string $sortOrder = 'desc'
    ): array {
        return $this->audioProjectRepository->findAudioProjectsWithFilters(
            userId: $userId,
            orgCode: $orgCode,
            filters: $filters,
            page: $page,
            pageSize: $pageSize,
            sortBy: $sortBy,
            sortOrder: $sortOrder
        );
    }

    /**
     * Delete audio project by project ID.
     */
    public function deleteAudioProjectByProjectId(int $projectId): void
    {
        $this->audioProjectRepository->deleteByProjectId($projectId);
    }

    /**
     * Save audio project entity.
     */
    public function save(AudioProjectEntity $audioProject): void
    {
        $this->audioProjectRepository->save($audioProject);
    }
}
