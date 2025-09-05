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
        public ?string $workspaceFilePath = null
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
}
