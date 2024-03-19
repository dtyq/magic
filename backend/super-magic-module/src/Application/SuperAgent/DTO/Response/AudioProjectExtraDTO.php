<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO\Response;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\AudioProjectEntity;

/**
 * Audio Project Extra Information DTO.
 */
class AudioProjectExtraDTO
{
    public function __construct(
        public readonly ?int $topicId,
        public readonly ?string $modelId,
        public readonly ?string $taskKey,
        public readonly bool $autoSummary,
        public readonly string $source,
        public readonly string $audioSource,
        public readonly ?int $audioFileId,
        public readonly ?string $deviceId,
        public readonly ?int $duration,
        public readonly ?int $fileSize,
        public readonly array $tags,
        public readonly string $currentPhase,
        public readonly ?string $phaseStatus,
        public readonly int $phasePercent,
        public readonly ?string $phaseError,
    ) {
    }

    /**
     * Create from AudioProjectEntity.
     */
    public static function fromEntity(AudioProjectEntity $entity): self
    {
        return new self(
            topicId: $entity->getTopicId(),
            modelId: $entity->getModelId(),
            taskKey: $entity->getTaskKey(),
            autoSummary: $entity->isAutoSummary(),
            source: $entity->getSource(),
            audioSource: $entity->getAudioSource(),
            audioFileId: $entity->getAudioFileId(),
            deviceId: $entity->getDeviceId(),
            duration: $entity->getDuration(),
            fileSize: $entity->getFileSize(),
            tags: $entity->getTags(),
            currentPhase: $entity->getCurrentPhase(),
            phaseStatus: $entity->getPhaseStatus(),
            phasePercent: $entity->getPhasePercent(),
            phaseError: $entity->getPhaseError(),
        );
    }

    /**
     * Create from array data (for list queries from repository).
     */
    public static function fromArray(array $data): self
    {
        return new self(
            topicId: isset($data['topic_id']) ? (int) $data['topic_id'] : null,
            modelId: $data['model_id'] ?? null,
            taskKey: $data['task_key'] ?? null,
            autoSummary: (bool) ($data['auto_summary'] ?? true),
            source: $data['source'] ?? 'app',
            audioSource: $data['audio_source'] ?? 'recorded',
            audioFileId: isset($data['audio_file_id']) ? (int) $data['audio_file_id'] : null,
            deviceId: $data['device_id'] ?? null,
            duration: isset($data['duration']) ? (int) $data['duration'] : null,
            fileSize: isset($data['file_size']) ? (int) $data['file_size'] : null,
            tags: isset($data['tags']) && is_string($data['tags'])
                ? json_decode($data['tags'], true)
                : ($data['tags'] ?? []),
            currentPhase: $data['current_phase'] ?? 'waiting',
            phaseStatus: $data['phase_status'] ?? null,
            phasePercent: isset($data['phase_percent']) ? (int) $data['phase_percent'] : 0,
            phaseError: $data['phase_error'] ?? null,
        );
    }

    /**
     * Convert to array for API response.
     */
    public function toArray(): array
    {
        return [
            'topic_id' => $this->topicId,
            'model_id' => $this->modelId,
            'task_key' => $this->taskKey,
            'auto_summary' => $this->autoSummary,
            'source' => $this->source,
            'audio_source' => $this->audioSource,
            'audio_file_id' => $this->audioFileId,
            'device_id' => $this->deviceId,
            'duration' => $this->duration,
            'file_size' => $this->fileSize,
            'tags' => $this->tags,
            'current_phase' => $this->currentPhase,
            'phase_status' => $this->phaseStatus,
            'phase_percent' => $this->phasePercent,
            'phase_error' => $this->phaseError,
        ];
    }
}
