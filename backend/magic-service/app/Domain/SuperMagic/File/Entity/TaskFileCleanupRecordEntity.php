<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Entity;

use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Enum\FileDeletionPolicy;
use App\Infrastructure\Core\AbstractEntity;

/**
 * task_file 异步物理删除任务及删除前快照。
 */
class TaskFileCleanupRecordEntity extends AbstractEntity
{
    protected int $id = 0;

    protected string $deletionOperationId = '';

    protected int $originalFileId = 0;

    protected int $projectId = 0;

    protected int $topicId = 0;

    protected int $taskId = 0;

    protected ?int $parentId = null;

    protected string $userId = '';

    protected string $organizationCode = '';

    protected string $spaceType = 'project';

    protected string $fileName = '';

    protected string $fileKey = '';

    protected bool $isDirectory = false;

    protected string $deletionPolicy = '';

    protected string $deleteSource = '';

    protected string $deleteReason = '';

    protected string $deletedBy = '';

    protected string $snapshot = '{}';

    protected string $archivedAt = '';

    protected string $recordType = 'root';

    protected int $rootFileId = 0;

    protected string $status = 'pending';

    protected ?string $errorMessage = null;

    protected int $attemptCount = 0;

    protected ?string $claimedAt = null;

    protected ?string $processedAt = null;

    public function getId(): int
    {
        return $this->id;
    }

    public static function fromTaskFile(
        TaskFileEntity $file,
        string $operationId,
        FileDeletionPolicy $policy,
        DeleteEventSource $source,
        string $reason,
        string $deletedBy,
        string $recordType = 'root',
        ?int $rootFileId = null
    ): self {
        $rootFileId ??= $file->getFileId();

        return new self([
            'deletion_operation_id' => $operationId,
            'original_file_id' => $file->getFileId(),
            'project_id' => $file->getProjectId(),
            'topic_id' => $file->getTopicId(),
            'task_id' => $file->getTaskId(),
            'parent_id' => $file->getParentId(),
            'user_id' => $file->getUserId(),
            'organization_code' => $file->getOrganizationCode(),
            'space_type' => $file->getSpaceType(),
            'file_name' => $file->getFileName(),
            'file_key' => $file->getFileKey(),
            'is_directory' => $file->getIsDirectory(),
            'deletion_policy' => $policy->value,
            'delete_source' => $source->value,
            'delete_reason' => $reason,
            'deleted_by' => $deletedBy,
            'snapshot' => json_encode($file->toArray(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'archived_at' => date('Y-m-d H:i:s'),
            'record_type' => $recordType,
            'root_file_id' => $rootFileId,
            'status' => 'pending',
            'attempt_count' => 0,
        ]);
    }

    public function getRecordType(): string
    {
        return $this->recordType;
    }

    public function getDeletionOperationId(): string
    {
        return $this->deletionOperationId;
    }

    public function getOriginalFileId(): int
    {
        return $this->originalFileId;
    }

    public function getDeleteSource(): string
    {
        return $this->deleteSource;
    }

    public function getDeleteReason(): string
    {
        return $this->deleteReason;
    }

    public function getDeletedBy(): string
    {
        return $this->deletedBy;
    }

    public function getRootFileId(): int
    {
        return $this->rootFileId;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function getAttemptCount(): int
    {
        return $this->attemptCount;
    }

    public function getClaimedAt(): ?string
    {
        return $this->claimedAt;
    }

    public function getProcessedAt(): ?string
    {
        return $this->processedAt;
    }
}
