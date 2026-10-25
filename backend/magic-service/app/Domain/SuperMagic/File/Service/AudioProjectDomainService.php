<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Domain\SuperMagic\File\Entity\AudioProjectEntity;
use App\Domain\SuperMagic\File\Repository\Facade\AudioProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use InvalidArgumentException;

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

    /**
     * Copy audio project extension data for a forked project.
     *
     * The fork receives a new topic and copied files, so source task identifiers
     * and audio file references must not be reused here. The audio_file_id is
     * patched after file migration builds the source-to-target file ID map.
     */
    public function copyAudioProjectForFork(
        int $sourceProjectId,
        int $forkProjectId,
        ?int $forkTopicId
    ): ?AudioProjectEntity {
        $sourceAudioProject = $this->getAudioProjectByProjectId($sourceProjectId);
        if ($sourceAudioProject === null) {
            return null;
        }

        $forkAudioProject = new AudioProjectEntity();
        $forkAudioProject->setProjectId($forkProjectId)
            ->setTopicId($forkTopicId)
            ->setModelId($sourceAudioProject->getModelId())
            ->setTaskKey(null)
            ->setAutoSummary($sourceAudioProject->isAutoSummary())
            ->setSource($sourceAudioProject->getSource())
            ->setAudioSource($sourceAudioProject->getAudioSource())
            ->setAudioFileId(null)
            ->setDeviceId($sourceAudioProject->getDeviceId())
            ->setDuration($sourceAudioProject->getDuration())
            ->setFileSize($sourceAudioProject->getFileSize())
            ->setLocation($sourceAudioProject->getLocation())
            ->setTags($sourceAudioProject->getTags())
            ->setCurrentPhase($sourceAudioProject->getCurrentPhase())
            ->setPhaseStatus($sourceAudioProject->getPhaseStatus())
            ->setPhasePercent($sourceAudioProject->getPhasePercent())
            ->setPhaseError($sourceAudioProject->getPhaseError());

        $this->audioProjectRepository->save($forkAudioProject);

        return $forkAudioProject;
    }

    /**
     * Update the forked audio project to point at the copied audio file.
     *
     * @param array<int, int> $sourceToForkFileIdMap source file ID => fork file ID
     */
    public function updateForkedAudioFileIdFromMigrationMap(
        int $sourceProjectId,
        int $forkProjectId,
        array $sourceToForkFileIdMap
    ): bool {
        $sourceAudioProject = $this->getAudioProjectByProjectId($sourceProjectId);
        $sourceAudioFileId = $sourceAudioProject?->getAudioFileId();
        if ($sourceAudioFileId === null) {
            return false;
        }

        if (! array_key_exists($sourceAudioFileId, $sourceToForkFileIdMap)) {
            return false;
        }

        $forkAudioFileId = (int) $sourceToForkFileIdMap[$sourceAudioFileId];
        if ($forkAudioFileId <= 0) {
            return false;
        }

        return $this->audioProjectRepository->updateByProjectId($forkProjectId, [
            'audio_file_id' => $forkAudioFileId,
        ]) > 0;
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
     * Update recording metadata (duration, fileSize, audioSource, audioFileId, location).
     *
     * Business Logic: Update audio file metadata after merging.
     * Extracted from: completeMergingPhaseIfExists()
     *
     * @param int $projectId Project ID
     * @param null|int $duration Audio duration (seconds)
     * @param null|int $fileSize File size (bytes)
     * @param null|string $audioSource Audio source (recorded/imported)
     * @param null|int $audioFileId Audio file ID
     * @param null|string $location Recording location
     * @return bool Returns true if project exists and updated, false if not exists
     */
    public function updateRecordingMetadata(
        int $projectId,
        ?int $duration = null,
        ?int $fileSize = null,
        ?string $audioSource = null,
        ?int $audioFileId = null,
        ?string $location = null
    ): bool {
        // Build partial update payload — only include non-null fields to avoid
        // overwriting phase state (current_phase, phase_percent, etc.) that may
        // have been written concurrently by syncPhaseStateToDatabase().
        $data = [];
        if ($duration !== null) {
            $data['duration'] = $duration;
        }
        if ($fileSize !== null) {
            $data['file_size'] = $fileSize;
        }
        if ($audioSource !== null) {
            $data['audio_source'] = $audioSource;
        }
        if ($audioFileId !== null) {
            $data['audio_file_id'] = $audioFileId;
        }
        if ($location !== null) {
            $data['location'] = $location;
        }

        if (empty($data)) {
            return true;
        }

        $affected = $this->audioProjectRepository->updateByProjectId($projectId, $data);

        // 0 rows updated means the audio project record does not exist yet
        return $affected >= 0;
    }

    /**
     * Persist an audio format without allowing a task to switch formats.
     */
    public function setAudioFormat(int $projectId, string $audioFormat): bool
    {
        $format = strtolower(ltrim(trim($audioFormat), '.'));
        if ($format === '' || ! preg_match('/^[a-z0-9]{1,16}$/', $format)) {
            throw new InvalidArgumentException('Invalid audio format');
        }

        $audioProject = $this->getAudioProjectByProjectId($projectId);
        if ($audioProject === null) {
            return false;
        }

        $existing = $audioProject->getAudioFormat();
        if ($existing !== null && strtolower($existing) !== $format) {
            throw new InvalidArgumentException(sprintf(
                'Audio format conflict: existing=%s, requested=%s',
                $existing,
                $format
            ));
        }

        $this->audioProjectRepository->setAudioFormatIfUnset($projectId, $format);
        return true;
    }

    /**
     * Deep-merge audio project extra data without touching other columns.
     */
    public function mergeAudioProjectExtra(int $projectId, array $extraPatch): bool
    {
        if (empty($extraPatch)) {
            return true;
        }

        $audioProject = $this->getAudioProjectByProjectId($projectId);
        if ($audioProject === null) {
            return false;
        }

        $mergedExtra = $this->mergeAssocRecursive($audioProject->getExtra() ?? [], $extraPatch);
        $affected = $this->audioProjectRepository->updateByProjectId($projectId, [
            'extra' => $mergedExtra,
        ]);

        return $affected >= 0;
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

    private function mergeAssocRecursive(array $base, array $patch): array
    {
        foreach ($patch as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
                $base[$key] = $this->mergeAssocRecursive($base[$key], $value);
                continue;
            }

            $base[$key] = $value;
        }

        return $base;
    }
}
