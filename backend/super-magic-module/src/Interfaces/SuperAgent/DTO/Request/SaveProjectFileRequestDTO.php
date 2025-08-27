<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use JsonSerializable;

/**
 * 保存项目文件请求 DTO.
 */
class SaveProjectFileRequestDTO implements JsonSerializable
{
    /**
     * 项目ID（可选）.
     */
    private ?string $projectId = null;

    /**
     * 话题ID（可选）.
     */
    private string $topicId = '';

    /**
     * 任务ID（可选）.
     */
    private string $taskId = '';

    /**
     * 文件键（OSS中的路径）.
     */
    private string $fileKey = '';

    /**
     * 文件名.
     */
    private string $fileName = '';

    /**
     * 文件大小（字节）.
     */
    private int $fileSize = 0;

    /**
     * 文件类型（可选，默认为user_upload）.
     */
    private string $fileType = FileType::USER_UPLOAD->value;

    /**
     * 是否是目录（可选，默认为false）.
     */
    private bool $isDirectory = false;

    /**
     * 排序（可选，默认为0）.
     */
    private int $sort = 0;

    /**
     * 父级ID（可选，默认为null）.
     */
    private string $parentId = '';

    /**
     * 存储类型（可选，默认为空字符串）.
     */
    private string $storageType = StorageType::WORKSPACE->value;

    /**
     * 前置文件ID，用于指定插入位置，0=第一位，-1=末尾（默认）.
     */
    private string $preFileId = '-1';

    /**
     * 来源字段.
     */
    private int $source = 0;

    /**
     * 从请求数据创建DTO.
     */
    public static function fromRequest(array $data): self
    {
        $instance = new self();

        $instance->projectId = $data['project_id'] ?? null;
        $instance->topicId = $data['topic_id'] ?? '';
        $instance->taskId = $data['task_id'] ?? '';
        $instance->source = (int) ($data['source'] ?? 0);
        $instance->fileKey = $data['file_key'] ?? '';
        $instance->fileName = $data['file_name'] ?? '';
        $instance->fileSize = (int) ($data['file_size'] ?? 0);
        $instance->fileType = $data['file_type'] ?? FileType::USER_UPLOAD->value;
        $instance->isDirectory = (bool) ($data['is_directory'] ?? false);
        $instance->sort = (int) ($data['sort'] ?? 0);
        $instance->parentId = isset($data['parent_id']) ? $data['parent_id'] : '';
        $instance->storageType = $data['storage_type'] ?? StorageType::WORKSPACE;
        $instance->preFileId = $data['pre_file_id'] ?? '-1';

        return $instance;
    }

    public function getProjectId(): ?string
    {
        return $this->projectId;
    }

    public function setProjectId(?string $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    public function setFileKey(string $fileKey): self
    {
        $this->fileKey = $fileKey;
        return $this;
    }

    public function getFileName(): string
    {
        return $this->fileName;
    }

    public function setFileName(string $fileName): self
    {
        $this->fileName = $fileName;
        return $this;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function setFileSize(int $fileSize): self
    {
        $this->fileSize = $fileSize;
        return $this;
    }

    public function getFileType(): string
    {
        return $this->fileType;
    }

    public function setFileType(string $fileType): self
    {
        $this->fileType = $fileType;
        return $this;
    }

    public function getIsDirectory(): bool
    {
        return $this->isDirectory;
    }

    public function setIsDirectory(bool $isDirectory): self
    {
        $this->isDirectory = $isDirectory;
        return $this;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): self
    {
        $this->sort = $sort;
        return $this;
    }

    public function getParentId(): string
    {
        return $this->parentId;
    }

    public function setParentId(string $parentId): self
    {
        $this->parentId = $parentId;
        return $this;
    }

    public function getStorageType(): string
    {
        return $this->storageType;
    }

    public function setStorageType(string $storageType): self
    {
        $this->storageType = $storageType;
        return $this;
    }

    public function getPreFileId(): string
    {
        return $this->preFileId;
    }

    public function setPreFileId(string $preFileId): self
    {
        $this->preFileId = $preFileId;
        return $this;
    }

    public function getSource(): int
    {
        return $this->source;
    }

    public function setSource(int $source): self
    {
        $this->source = $source;
        return $this;
    }

    /**
     * 转换为 TaskFileEntity 实体.
     */
    public function toEntity(): TaskFileEntity
    {
        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileKey($this->fileKey);
        $taskFileEntity->setFileName($this->fileName);
        $taskFileEntity->setFileSize($this->fileSize);
        $taskFileEntity->setFileType($this->fileType);
        $taskFileEntity->setSource($this->source);

        // 设置项目ID（如果有）
        if (! empty($this->projectId)) {
            $taskFileEntity->setProjectId((int) $this->projectId);
        }

        if (! empty($this->parentId)) {
            // 使用DTO中的值
            $taskFileEntity->setIsDirectory($this->isDirectory);
        }
        $taskFileEntity->setSort($this->sort);
        $taskFileEntity->setParentId(! empty($this->parentId) ? (int) $this->parentId : 0);

        // 设置存储类型
        if (! empty($this->storageType)) {
            $taskFileEntity->setStorageType($this->storageType);
        } else {
            $taskFileEntity->setStorageType(StorageType::WORKSPACE);
        }

        if (! empty($this->source)) {
            $taskFileEntity->setSource($this->source);
        } else {
            $taskFileEntity->setSource(TaskFileSource::DEFAULT);
        }

        $taskFileEntity->setIsHidden(false);

        return $taskFileEntity;
    }

    /**
     * 实现JsonSerializable接口.
     */
    public function jsonSerialize(): array
    {
        return [
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'source' => $this->source,
            'file_key' => $this->fileKey,
            'file_name' => $this->fileName,
            'file_size' => $this->fileSize,
            'file_type' => $this->fileType,
            'is_directory' => $this->isDirectory,
            'sort' => $this->sort,
            'parent_id' => $this->parentId,
            'storage_type' => $this->storageType,
            'pre_file_id' => $this->preFileId,
        ];
    }
}
