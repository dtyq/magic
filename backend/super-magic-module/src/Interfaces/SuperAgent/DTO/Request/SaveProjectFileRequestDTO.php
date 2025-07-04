<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use JsonSerializable;

/**
 * 保存项目文件请求 DTO.
 */
class SaveProjectFileRequestDTO implements JsonSerializable
{
    /**
     * 项目ID.
     */
    private string $projectId = '';

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
    private string $fileType = 'user_upload';

    /**
     * 从请求数据创建DTO.
     */
    public static function fromRequest(array $data): self
    {
        $instance = new self();

        $instance->projectId = $data['project_id'] ?? '';
        $instance->topicId = $data['topic_id'] ?? '';
        $instance->taskId = $data['task_id'] ?? '';
        $instance->fileKey = $data['file_key'] ?? '';
        $instance->fileName = $data['file_name'] ?? '';
        $instance->fileSize = (int) ($data['file_size'] ?? 0);
        $instance->fileType = $data['file_type'] ?? 'user_upload';

        return $instance;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): self
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

    /**
     * 实现JsonSerializable接口.
     */
    public function jsonSerialize(): array
    {
        return [
            'project_id' => $this->projectId,
            'topic_id' => $this->topicId,
            'task_id' => $this->taskId,
            'file_key' => $this->fileKey,
            'file_name' => $this->fileName,
            'file_size' => $this->fileSize,
            'file_type' => $this->fileType,
        ];
    }
}
