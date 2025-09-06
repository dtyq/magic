<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ForkStatus;

/**
 * Project Fork Entity.
 */
class ProjectForkEntity extends AbstractEntity
{
    /**
     * @var int Fork record ID
     */
    protected int $id = 0;

    /**
     * @var int Source project ID
     */
    protected int $sourceProjectId = 0;

    /**
     * @var int Forked project ID
     */
    protected int $forkProjectId = 0;

    /**
     * @var int Target workspace ID
     */
    protected int $targetWorkspaceId = 0;

    /**
     * @var string User ID who initiated the fork
     */
    protected string $userId = '';

    /**
     * @var string User organization code
     */
    protected string $userOrganizationCode = '';

    /**
     * @var ForkStatus Fork status
     */
    protected ForkStatus $status = ForkStatus::RUNNING;

    /**
     * @var int Progress percentage (0-100)
     */
    protected int $progress = 0;

    /**
     * @var null|int Current processing file ID for resume
     */
    protected ?int $currentFileId = null;

    /**
     * @var int Total files count
     */
    protected int $totalFiles = 0;

    /**
     * @var int Processed files count
     */
    protected int $processedFiles = 0;

    /**
     * @var null|string Error message if failed
     */
    protected ?string $errMsg = null;

    /**
     * @var string Created user ID
     */
    protected string $createdUid = '';

    /**
     * @var string Updated user ID
     */
    protected string $updatedUid = '';

    /**
     * @var null|string Created time
     */
    protected ?string $createdAt = null;

    /**
     * @var null|string Updated time
     */
    protected ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        $this->initProperty($data);
    }

    /**
     * Convert to array.
     */
    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'source_project_id' => $this->sourceProjectId,
            'fork_project_id' => $this->forkProjectId,
            'target_workspace_id' => $this->targetWorkspaceId,
            'user_id' => $this->userId,
            'user_organization_code' => $this->userOrganizationCode,
            'status' => $this->status->value,
            'progress' => $this->progress,
            'current_file_id' => $this->currentFileId,
            'total_files' => $this->totalFiles,
            'processed_files' => $this->processedFiles,
            'err_msg' => $this->errMsg,
            'created_uid' => $this->createdUid,
            'updated_uid' => $this->updatedUid,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];

        // Remove null values
        return array_filter($result, function ($value) {
            return $value !== null;
        });
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int|string $id): self
    {
        $this->id = (int) $id;
        return $this;
    }

    public function getSourceProjectId(): int
    {
        return $this->sourceProjectId;
    }

    public function setSourceProjectId(int|string $sourceProjectId): self
    {
        $this->sourceProjectId = (int) $sourceProjectId;
        return $this;
    }

    public function getForkProjectId(): int
    {
        return $this->forkProjectId;
    }

    public function setForkProjectId(int|string $forkProjectId): self
    {
        $this->forkProjectId = (int) $forkProjectId;
        return $this;
    }

    public function getTargetWorkspaceId(): int
    {
        return $this->targetWorkspaceId;
    }

    public function setTargetWorkspaceId(int|string $targetWorkspaceId): self
    {
        $this->targetWorkspaceId = (int) $targetWorkspaceId;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getUserOrganizationCode(): string
    {
        return $this->userOrganizationCode;
    }

    public function setUserOrganizationCode(string $userOrganizationCode): self
    {
        $this->userOrganizationCode = $userOrganizationCode;
        return $this;
    }

    public function getStatus(): ForkStatus
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = ForkStatus::from($status);
        return $this;
    }

    public function getProgress(): int
    {
        return $this->progress;
    }

    public function setProgress(int $progress): self
    {
        $this->progress = max(0, min(100, $progress));
        return $this;
    }

    public function getCurrentFileId(): ?int
    {
        return $this->currentFileId;
    }

    public function setCurrentFileId(?int $currentFileId): self
    {
        $this->currentFileId = $currentFileId;
        return $this;
    }

    public function getTotalFiles(): int
    {
        return $this->totalFiles;
    }

    public function setTotalFiles(int $totalFiles): self
    {
        $this->totalFiles = max(0, $totalFiles);
        return $this;
    }

    public function getProcessedFiles(): int
    {
        return $this->processedFiles;
    }

    public function setProcessedFiles(int $processedFiles): self
    {
        $this->processedFiles = max(0, $processedFiles);
        return $this;
    }

    public function getErrMsg(): ?string
    {
        return $this->errMsg;
    }

    public function setErrMsg(?string $errMsg): self
    {
        $this->errMsg = $errMsg;
        return $this;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): self
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(string $updatedUid): self
    {
        $this->updatedUid = $updatedUid;
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

    /**
     * Check if the fork is running.
     */
    public function isRunning(): bool
    {
        return $this->status->isRunning();
    }

    /**
     * Check if the fork is finished.
     */
    public function isFinished(): bool
    {
        return $this->status->isFinished();
    }

    /**
     * Check if the fork has failed.
     */
    public function isFailed(): bool
    {
        return $this->status->isFailed();
    }

    /**
     * Check if the fork is completed (either finished or failed).
     */
    public function isCompleted(): bool
    {
        return $this->status->isCompleted();
    }

    /**
     * Mark the fork as running.
     */
    public function markAsRunning(): self
    {
        $this->status = ForkStatus::RUNNING;
        $this->errMsg = null;
        return $this;
    }

    /**
     * Mark the fork as finished.
     */
    public function markAsFinished(): self
    {
        $this->status = ForkStatus::FINISHED;
        $this->progress = 100;
        $this->errMsg = null;
        return $this;
    }

    /**
     * Mark the fork as failed.
     */
    public function markAsFailed(string $errorMessage): self
    {
        $this->status = ForkStatus::FAILED;
        $this->errMsg = $errorMessage;
        return $this;
    }

    /**
     * Update progress based on processed files.
     */
    public function updateProgress(): self
    {
        if ($this->totalFiles > 0) {
            $this->progress = (int) round(($this->processedFiles / $this->totalFiles) * 100);
        }
        return $this;
    }

    /**
     * Increment processed files count and update progress.
     */
    public function incrementProcessedFiles(): self
    {
        ++$this->processedFiles;
        $this->updateProgress();
        return $this;
    }

    /**
     * Get progress percentage as string.
     */
    public function getProgressPercentage(): string
    {
        return $this->progress . '%';
    }

    /**
     * Check if this fork can be resumed.
     */
    public function canResume(): bool
    {
        return $this->isRunning() && $this->currentFileId !== null;
    }

    /**
     * Reset the fork to initial state.
     */
    public function reset(): self
    {
        $this->status = ForkStatus::RUNNING;
        $this->progress = 0;
        $this->currentFileId = null;
        $this->processedFiles = 0;
        $this->errMsg = null;
        return $this;
    }
}
