<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;

class TaskFileEntity extends AbstractEntity
{
    protected int $fileId = 0;

    protected string $userId = '';

    protected string $organizationCode = '';

    protected int $projectId = 0;

    protected int $topicId = 0;

    protected int $taskId = 0;

    protected string $fileType = '';

    protected string $fileName = '';

    protected string $fileExtension = '';

    protected string $fileKey = '';

    protected int $fileSize = 0;

    protected ?string $externalUrl = '';

    protected StorageType $storageType;

    protected bool $isHidden = false;

    protected bool $isDirectory = false;

    protected int $sort = 0;

    protected ?int $parentId = null;

    protected ?string $metadata = null;

    protected TaskFileSource $source;

    protected string $createdAt = '';

    protected string $updatedAt = '';

    protected ?string $deletedAt = null;

    protected ?int $latestModifiedTopicId = null;

    protected ?int $latestModifiedTaskId = null;

    public function getFileId(): int
    {
        return $this->fileId;
    }

    public function setFileId(int $fileId): void
    {
        $this->fileId = $fileId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function setTopicId(int $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getTaskId(): int
    {
        return $this->taskId;
    }

    public function setTaskId(int $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getFileType(): string
    {
        return $this->fileType;
    }

    public function setFileType(string $fileType): void
    {
        $this->fileType = $fileType;
    }

    public function getFileName(): string
    {
        return $this->fileName;
    }

    public function setFileName(string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function getFileExtension(): string
    {
        return $this->fileExtension;
    }

    public function setFileExtension(string $fileExtension): void
    {
        $this->fileExtension = $fileExtension;
    }

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    public function setFileKey(string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function setFileSize(int $fileSize): void
    {
        $this->fileSize = $fileSize;
    }

    public function getExternalUrl(): ?string
    {
        return $this->externalUrl;
    }

    public function setExternalUrl(?string $externalUrl): void
    {
        $this->externalUrl = $externalUrl;
    }

    public function getStorageType(): StorageType
    {
        if (! isset($this->storageType)) {
            $this->storageType = StorageType::WORKSPACE;
        }
        return $this->storageType;
    }

    public function setStorageType(StorageType|string $storageType): void
    {
        if ($storageType instanceof StorageType) {
            $this->storageType = $storageType;
        } else {
            $this->storageType = StorageType::fromValue($storageType);
        }
    }

    public function getIsHidden(): bool
    {
        return $this->isHidden;
    }

    public function setIsHidden(bool $isHidden): void
    {
        $this->isHidden = $isHidden;
    }

    public function getIsDirectory(): bool
    {
        return $this->isDirectory;
    }

    public function setIsDirectory(bool $isDirectory): void
    {
        $this->isDirectory = $isDirectory;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    public function getParentId(): ?int
    {
        return $this->parentId;
    }

    public function setParentId(?int $parentId): void
    {
        $this->parentId = $parentId;
    }

    public function getMetadata(): ?string
    {
        return $this->metadata;
    }

    public function setMetadata(?string $metadata): void
    {
        $this->metadata = $metadata;
    }

    public function getSource(): TaskFileSource
    {
        return $this->source;
    }

    public function setSource(int|string|TaskFileSource $source): void
    {
        if ($source instanceof TaskFileSource) {
            $this->source = $source;
        } else {
            $this->source = TaskFileSource::fromValue($source);
        }
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getLatestModifiedTopicId(): ?int
    {
        return $this->latestModifiedTopicId;
    }

    public function setLatestModifiedTopicId(?int $latestModifiedTopicId): void
    {
        $this->latestModifiedTopicId = $latestModifiedTopicId;
    }

    public function getLatestModifiedTaskId(): ?int
    {
        return $this->latestModifiedTaskId;
    }

    public function setLatestModifiedTaskId(?int $latestModifiedTaskId): void
    {
        $this->latestModifiedTaskId = $latestModifiedTaskId;
    }

    public function toArray(): array
    {
        return [
            'file_id' => $this->fileId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'file_type' => $this->fileType,
            'file_name' => $this->fileName,
            'file_extension' => $this->fileExtension,
            'file_key' => $this->fileKey,
            'file_size' => $this->fileSize,
            'external_url' => $this->externalUrl,
            'storage_type' => $this->storageType->value,
            'is_hidden' => $this->isHidden,
            'is_directory' => $this->isDirectory,
            'sort' => $this->sort,
            'parent_id' => $this->parentId,
            'metadata' => $this->metadata,
            'source' => $this->source->value,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
            'latest_modified_topic_id' => $this->latestModifiedTopicId,
            'latest_modified_task_id' => $this->latestModifiedTaskId,
        ];
    }
}
