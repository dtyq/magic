<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

/**
 * ASR总结请求DTO
 * 保存总结请求的所有必传和可选参数.
 */
readonly class SummaryRequestDTO
{
    public function __construct(
        public string $taskKey,
        public string $projectId,
        public string $topicId,
        public string $modelId,
        public ?string $workspaceFilePath = null,
        public ?NoteDTO $note = null,
        public ?string $asrStreamContent = null,
        public ?string $generatedTitle = null
    ) {
    }

    /**
     * 是否有工作区文件路径.
     */
    public function hasWorkspaceFilePath(): bool
    {
        return ! empty($this->workspaceFilePath);
    }

    /**
     * 从工作区文件路径提取目录.
     */
    public function getWorkspaceDirectory(): ?string
    {
        if (! $this->hasWorkspaceFilePath()) {
            return null;
        }

        return dirname($this->workspaceFilePath);
    }

    /**
     * 从工作区文件路径提取文件名.
     */
    public function getWorkspaceFileName(): ?string
    {
        if (! $this->hasWorkspaceFilePath()) {
            return null;
        }

        return basename($this->workspaceFilePath);
    }

    /**
     * 是否有笔记.
     */
    public function hasNote(): bool
    {
        return $this->note !== null && $this->note->hasContent();
    }

    /**
     * 是否包含流式识别文本.
     */
    public function hasAsrStreamContent(): bool
    {
        return ! empty($this->asrStreamContent);
    }

    /**
     * 获取笔记的文件名.
     */
    public function getNoteFileName(): ?string
    {
        if (! $this->hasNote()) {
            return null;
        }

        return $this->note->generateFileName();
    }
}
