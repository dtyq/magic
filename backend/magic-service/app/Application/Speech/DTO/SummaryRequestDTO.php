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
        public ?string $fileId = null,
        public ?NoteDTO $note = null,
        public ?string $asrStreamContent = null,
        public ?string $generatedTitle = null
    ) {
    }

    /**
     * 是否有文件ID（场景二：直接上传已有音频文件）.
     */
    public function hasFileId(): bool
    {
        return ! empty($this->fileId);
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
