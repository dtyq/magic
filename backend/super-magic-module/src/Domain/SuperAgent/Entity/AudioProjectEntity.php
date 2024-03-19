<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;

/**
 * Audio Project Entity.
 */
class AudioProjectEntity extends AbstractEntity
{
    protected int $id = 0;

    protected int $projectId = 0;

    protected string $source = 'app';  // app | device

    protected string $audioSource = 'recorded';  // recorded | imported

    protected ?int $audioFileId = null;

    protected ?string $deviceId = null;

    protected ?int $duration = null;

    protected ?int $fileSize = null;

    protected array $tags = [];

    // Auto summary configuration fields
    protected bool $autoSummary = true;

    protected ?string $taskKey = null;

    protected ?string $modelId = null;

    protected ?int $topicId = null;

    // Phase management fields (aligned with AsrTaskStatusDTO)
    protected string $currentPhase = 'waiting';  // Default: waiting

    protected ?string $phaseStatus = null;

    protected int $phasePercent = 0;

    protected ?string $phaseError = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    // ========== Getter/Setter ==========

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function setSource(string $source): self
    {
        $this->source = $source;
        return $this;
    }

    public function getAudioSource(): string
    {
        return $this->audioSource;
    }

    public function setAudioSource(string $audioSource): self
    {
        $this->audioSource = $audioSource;
        return $this;
    }

    public function getAudioFileId(): ?int
    {
        return $this->audioFileId;
    }

    public function setAudioFileId(?int $audioFileId): self
    {
        $this->audioFileId = $audioFileId;
        return $this;
    }

    public function getDeviceId(): ?string
    {
        return $this->deviceId;
    }

    public function setDeviceId(?string $deviceId): self
    {
        $this->deviceId = $deviceId;
        return $this;
    }

    // ========== Phase Management Methods ==========

    public function getCurrentPhase(): string
    {
        return $this->currentPhase;
    }

    public function setCurrentPhase(string $currentPhase): self
    {
        $this->currentPhase = $currentPhase;
        return $this;
    }

    public function getPhaseStatus(): ?string
    {
        return $this->phaseStatus;
    }

    public function setPhaseStatus(?string $phaseStatus): self
    {
        $this->phaseStatus = $phaseStatus;
        return $this;
    }

    public function getPhasePercent(): int
    {
        return $this->phasePercent;
    }

    public function setPhasePercent(int $phasePercent): self
    {
        $this->phasePercent = $phasePercent;
        return $this;
    }

    public function getPhaseError(): ?string
    {
        return $this->phaseError;
    }

    public function setPhaseError(?string $phaseError): self
    {
        $this->phaseError = $phaseError;
        return $this;
    }

    /**
     * Start merging phase.
     */
    public function startMergingPhase(): self
    {
        $this->currentPhase = 'merging';
        $this->phaseStatus = 'in_progress';
        $this->phasePercent = 0;
        $this->phaseError = null;
        return $this;
    }

    /**
     * Complete merging phase.
     */
    public function completeMergingPhase(): self
    {
        $this->currentPhase = 'merging';
        $this->phaseStatus = 'completed';
        $this->phasePercent = 100;
        $this->phaseError = null;
        return $this;
    }

    /**
     * Fail merging phase.
     */
    public function failMergingPhase(string $error): self
    {
        $this->currentPhase = 'merging';
        $this->phaseStatus = 'failed';
        $this->phaseError = $error;
        return $this;
    }

    /**
     * Start summarizing phase.
     */
    public function startSummarizingPhase(): self
    {
        $this->currentPhase = 'summarizing';
        $this->phaseStatus = 'in_progress';
        $this->phasePercent = 0;
        $this->phaseError = null;
        return $this;
    }

    /**
     * Complete summarizing phase.
     */
    public function completeSummarizingPhase(): self
    {
        $this->currentPhase = 'summarizing';
        $this->phaseStatus = 'completed';
        $this->phasePercent = 100;
        $this->phaseError = null;
        return $this;
    }

    /**
     * Fail summarizing phase.
     */
    public function failSummarizingPhase(string $error): self
    {
        $this->currentPhase = 'summarizing';
        $this->phaseStatus = 'failed';
        $this->phaseError = $error;
        return $this;
    }

    /**
     * Check if currently in waiting phase.
     */
    public function isWaiting(): bool
    {
        return $this->currentPhase === 'waiting';
    }

    /**
     * Check if currently in merging phase.
     */
    public function isMerging(): bool
    {
        return $this->currentPhase === 'merging';
    }

    /**
     * Check if currently in summarizing phase.
     */
    public function isSummarizing(): bool
    {
        return $this->currentPhase === 'summarizing';
    }

    /**
     * Check if phase is in progress.
     */
    public function isPhaseInProgress(): bool
    {
        return $this->phaseStatus === 'in_progress';
    }

    /**
     * Check if phase is completed.
     */
    public function isPhaseCompleted(): bool
    {
        return $this->phaseStatus === 'completed';
    }

    /**
     * Check if phase is failed.
     */
    public function isPhaseFailed(): bool
    {
        return $this->phaseStatus === 'failed';
    }

    /**
     * Check if fully completed (summarizing phase completed).
     */
    public function isFullyCompleted(): bool
    {
        return $this->currentPhase === 'summarizing' && $this->phaseStatus === 'completed';
    }

    public function getDuration(): ?int
    {
        return $this->duration;
    }

    public function setDuration(?int $duration): self
    {
        $this->duration = $duration;
        return $this;
    }

    public function getFileSize(): ?int
    {
        return $this->fileSize;
    }

    public function setFileSize(?int $fileSize): self
    {
        $this->fileSize = $fileSize;
        return $this;
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(array $tags): self
    {
        $this->tags = $tags;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function isAutoSummary(): bool
    {
        return $this->autoSummary;
    }

    public function setAutoSummary(bool $autoSummary): self
    {
        $this->autoSummary = $autoSummary;
        return $this;
    }

    public function getTaskKey(): ?string
    {
        return $this->taskKey;
    }

    public function setTaskKey(?string $taskKey): self
    {
        $this->taskKey = $taskKey;
        return $this;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function setModelId(?string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }

    public function getTopicId(): ?int
    {
        return $this->topicId;
    }

    public function setTopicId(?int $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->projectId,
            'source' => $this->source,
            'audio_source' => $this->audioSource,
            'audio_file_id' => $this->audioFileId,
            'device_id' => $this->deviceId,
            'duration' => $this->duration,
            'file_size' => $this->fileSize,
            'tags' => $this->tags,
            'auto_summary' => $this->autoSummary,
            'task_key' => $this->taskKey,
            'model_id' => $this->modelId,
            'topic_id' => $this->topicId,
            'current_phase' => $this->currentPhase,
            'phase_status' => $this->phaseStatus,
            'phase_percent' => $this->phasePercent,
            'phase_error' => $this->phaseError,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
