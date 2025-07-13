<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

class TaskFileItemDTO extends AbstractDTO
{
    /**
     * 文件ID.
     */
    public string $fileId;

    /**
     * 任务ID.
     */
    public string $taskId;

    /**
     * 项目ID.
     */
    public string $projectId = '';

    /**
     * 文件类型.
     */
    public string $fileType;

    /**
     * 文件名称.
     */
    public string $fileName;

    /**
     * 文件扩展名.
     */
    public string $fileExtension;

    /**
     * 文件键值.
     */
    public string $fileKey;

    /**
     * 文件相对路径.
     */
    public string $relativeFilePath;

    /**
     * 文件大小.
     */
    public int $fileSize;

    /**
     * 文件URL.
     */
    public string $fileUrl;

    /**
     * 是否为隐藏文件：true-是，false-否.
     */
    public bool $isHidden;

    /**
     * 主题ID.
     */
    public string $topicId = '';

    /**
     * 从实体创建DTO.
     */
    public static function fromEntity(TaskFileEntity $entity): self
    {
        $dto = new self();
        $dto->fileId = (string) $entity->getFileId();
        $dto->taskId = (string) $entity->getTaskId();
        $dto->projectId = (string) $entity->getProjectId();
        $dto->fileType = $entity->getFileType();
        $dto->fileName = $entity->getFileName();
        $dto->fileExtension = $entity->getFileExtension();
        $dto->fileKey = $entity->getFileKey();
        $dto->fileSize = $entity->getFileSize();
        $dto->relativeFilePath = '';
        $dto->fileUrl = $entity->getExternalUrl();
        $dto->isHidden = $entity->getIsHidden();
        $dto->topicId = (string) $entity->getTopicId();

        return $dto;
    }

    /**
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->fileId = (string) ($data['file_id'] ?? '');
        $dto->taskId = (string) ($data['task_id'] ?? '');
        $dto->projectId = (string) ($data['project_id'] ?? '');
        $dto->fileType = $data['file_type'] ?? '';
        $dto->fileName = $data['file_name'] ?? '';
        $dto->fileExtension = $data['file_extension'] ?? '';
        $dto->fileKey = $data['file_key'] ?? '';
        $dto->fileSize = $data['file_size'] ?? 0;
        $dto->relativeFilePath = $data['relative_file_path'] ?? '';
        $dto->fileUrl = $data['file_url'] ?? $data['external_url'] ?? '';
        $dto->isHidden = $data['is_hidden'] ?? false;
        $dto->topicId = (string) ($data['topic_id'] ?? '');
        return $dto;
    }

    /**
     * 转换为数组.
     * 输出保持下划线命名，以保持API兼容性.
     */
    public function toArray(): array
    {
        return [
            'file_id' => $this->fileId,
            'task_id' => $this->taskId,
            'project_id' => $this->projectId,
            'file_type' => $this->fileType,
            'file_name' => $this->fileName,
            'file_extension' => $this->fileExtension,
            'file_key' => $this->fileKey,
            'file_size' => $this->fileSize,
            'relative_file_path' => $this->relativeFilePath,
            'file_url' => $this->fileUrl,
            'is_hidden' => $this->isHidden,
            'topic_id' => $this->topicId,
        ];
    }
}
