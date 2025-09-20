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
     *
     * @param bool $useGeneratedTitle 是否使用生成的标题，如果为true且存在generatedTitle，则使用 {title}-笔记.{ext} 格式
     */
    public function getNoteFileName(bool $useGeneratedTitle = true): ?string
    {
        if (! $this->hasNote()) {
            return null;
        }

        // 如果需要使用生成标题且存在generatedTitle，则传递给note
        $titleToUse = ($useGeneratedTitle && ! empty($this->generatedTitle)) ? $this->generatedTitle : null;
        return $this->note->generateFileName($titleToUse);
    }
}
