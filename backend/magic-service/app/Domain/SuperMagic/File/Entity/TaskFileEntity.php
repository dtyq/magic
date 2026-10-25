<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Entity;

use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Infrastructure\Core\AbstractEntity;

class TaskFileEntity extends AbstractEntity
{
    protected int $fileId = 0;

    /**
     * Immediate source file ID for a copied TaskFile. Null means the file was
     * not created by copying an existing TaskFile (or the source is unknown).
     */
    protected ?int $sourceFileId = null;

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

    protected ?string $displayConfig = null;

    protected TaskFileSource $source;

    protected string $createdAt = '';

    protected string $updatedAt = '';

    protected ?string $deletedAt = null;

    protected ?int $latestModifiedTopicId = null;

    protected ?int $latestModifiedTaskId = null;

    protected int $latestVersion = 1;

    protected int $metadataVersion = 1;

    protected string $spaceType = 'project';

    /**
     * 从数据表原始行批量水合实体，跳过 BaseObject::set() 的字段名解析开销.
     *
     * 对比 `new self($model->toArray())`：那条路径每个字段都要走
     * getCamelizeValueFromCache()（驼峰缓存 key 拼串 + 查表）、property_exists()、
     * method_exists() 和一次动态方法调用，实测约 0.42µs/字段；一行 29 个字段约 12µs，
     * 一次 5000 行的文件树请求光这一层就超过 50ms，是整条链路里最大的一块 CPU。
     *
     * 字段类型与 TaskFileModel 的 casts 对齐：
     *   is_hidden / is_directory => bool，storage_type => StorageType，source => TaskFileSource。
     * 其中 storage_type 沿用 setStorageType() 的语义（StorageType::fromValue()），
     * 即 Eloquent cast 无法识别的取值（含 'object_storage'、''）一律回落 WORKSPACE；
     * source 用 tryFrom() 兜底到 DEFAULT —— Eloquent 的 enum cast 在这里会抛
     * ValueError 让整个请求 500，这里选择与 setSource() 一致的回落行为。
     * 其余字段的默认值与属性声明保持一致，因此行里缺列时的结果与
     * new self(['已存在的列...]) 相同。
     *
     * 两条路径的一致性由 TaskFileEntityRowHydrationTest 逐字段断言。
     *
     * 传入的应当是「未经 cast 的列值」，即 TaskFileModel::getAttributes() 的返回值
     * 或数据表原始行；不要传 Model::toArray() 的结果（那里面的枚举/布尔已经转换过）。
     *
     * @param array<string, mixed> $row 未经 Eloquent cast 的列值
     */
    public static function fromRow(array $row): self
    {
        $entity = new self();
        $entity->fileId = (int) ($row['file_id'] ?? 0);
        $entity->sourceFileId = isset($row['source_file_id']) ? (int) $row['source_file_id'] : null;
        $entity->userId = (string) ($row['user_id'] ?? '');
        $entity->organizationCode = (string) ($row['organization_code'] ?? '');
        $entity->projectId = (int) ($row['project_id'] ?? 0);
        $entity->topicId = (int) ($row['topic_id'] ?? 0);
        $entity->taskId = (int) ($row['task_id'] ?? 0);
        $entity->fileType = (string) ($row['file_type'] ?? '');
        $entity->fileName = (string) ($row['file_name'] ?? '');
        $entity->fileExtension = (string) ($row['file_extension'] ?? '');
        $entity->fileKey = (string) ($row['file_key'] ?? '');
        $entity->fileSize = (int) ($row['file_size'] ?? 0);
        // external_url：列缺失时保持声明默认 ''，列为 NULL 时保持 null
        if (array_key_exists('external_url', $row)) {
            $entity->externalUrl = $row['external_url'] === null ? null : (string) $row['external_url'];
        }
        $entity->storageType = StorageType::fromValue((string) ($row['storage_type'] ?? ''));
        $entity->isHidden = (bool) ($row['is_hidden'] ?? false);
        $entity->isDirectory = (bool) ($row['is_directory'] ?? false);
        $entity->sort = (int) ($row['sort'] ?? 0);
        $entity->parentId = isset($row['parent_id']) ? (int) $row['parent_id'] : null;
        $entity->metadata = isset($row['metadata']) ? (string) $row['metadata'] : null;
        $entity->displayConfig = isset($row['display_config']) ? (string) $row['display_config'] : null;
        $entity->source = TaskFileSource::tryFrom((int) ($row['source'] ?? 0)) ?? TaskFileSource::DEFAULT;
        $entity->createdAt = (string) ($row['created_at'] ?? '');
        $entity->updatedAt = (string) ($row['updated_at'] ?? '');
        $entity->deletedAt = isset($row['deleted_at']) ? (string) $row['deleted_at'] : null;
        $entity->latestModifiedTopicId = isset($row['latest_modified_topic_id']) ? (int) $row['latest_modified_topic_id'] : null;
        $entity->latestModifiedTaskId = isset($row['latest_modified_task_id']) ? (int) $row['latest_modified_task_id'] : null;
        $entity->latestVersion = (int) ($row['latest_version'] ?? 1);
        $entity->metadataVersion = (int) ($row['metadata_version'] ?? 1);
        $entity->spaceType = (string) ($row['space_type'] ?? FileSpaceType::PROJECT->value);

        return $entity;
    }

    public function getFileId(): int
    {
        return $this->fileId;
    }

    public function getSourceFileId(): ?int
    {
        return $this->sourceFileId;
    }

    public function setSourceFileId(?int $sourceFileId): void
    {
        $this->sourceFileId = $sourceFileId;
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

    /**
     * 判断当前文件是否为项目文件.
     */
    public function isProjectFile(): bool
    {
        return $this->projectId > 0;
    }

    /**
     * 判断当前文件是否需要创建版本副本.
     *
     * 文件版本覆盖工作区空间（project / user，如用户空间的记忆文件）；
     * topic 等内部状态空间不建版本。
     */
    public function shouldCreateVersionCopy(): bool
    {
        return in_array(
            $this->getSpaceType(),
            [FileSpaceType::PROJECT->value, FileSpaceType::USER->value],
            true
        )
            && ! $this->getIsDirectory();
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

    public function setIsHidden(bool|int $isHidden): void
    {
        $this->isHidden = (bool) $isHidden;
    }

    public function getIsDirectory(): bool
    {
        return $this->isDirectory;
    }

    public function setIsDirectory(bool|int $isDirectory): void
    {
        $this->isDirectory = (bool) $isDirectory;
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

    public function getDisplayConfig(): ?string
    {
        return $this->displayConfig;
    }

    public function setDisplayConfig(?string $displayConfig): void
    {
        $this->displayConfig = $displayConfig;
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
            $this->source = TaskFileSource::fromStrictValue($source);
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

    public function getLatestVersion(): int
    {
        return $this->latestVersion;
    }

    public function setLatestVersion(int $latestVersion): void
    {
        $this->latestVersion = $latestVersion;
    }

    public function getMetadataVersion(): int
    {
        return $this->metadataVersion;
    }

    public function setMetadataVersion(int $metadataVersion): void
    {
        $this->metadataVersion = $metadataVersion;
    }

    /**
     * 判断文件当前元数据修订号是否与编辑基准一致。
     */
    public function matchesMetadataRevision(int $expectedRevision): bool
    {
        return $this->metadataVersion === $expectedRevision;
    }

    public function getSpaceType(): string
    {
        return $this->spaceType;
    }

    public function setSpaceType(string $spaceType): void
    {
        $this->spaceType = $spaceType;
    }

    public function toArray(): array
    {
        return [
            'file_id' => $this->fileId,
            'source_file_id' => $this->sourceFileId,
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
            'display_config' => $this->displayConfig,
            'source' => $this->source->value,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'deleted_at' => $this->deletedAt,
            'latest_modified_topic_id' => $this->latestModifiedTopicId,
            'latest_modified_task_id' => $this->latestModifiedTaskId,
            'latest_version' => $this->latestVersion,
            'metadata_version' => $this->metadataVersion,
            'space_type' => $this->spaceType,
        ];
    }
}
