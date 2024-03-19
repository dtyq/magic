<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config;

/**
 * ASR 笔记文件配置
 * 用于 finishTask 接口的笔记文件处理配置.
 */
readonly class AsrNoteFileConfig
{
    /**
     * @param string $sourcePath 源文件路径（相对于 workspace）
     * @param string $targetPath 目标文件路径（相对于 workspace）
     * @param string $action 操作类型（rename_and_move）
     */
    public function __construct(
        private string $sourcePath,
        private string $targetPath,
        private string $action = 'rename_and_move'
    ) {
    }

    public function getSourcePath(): string
    {
        return $this->sourcePath;
    }

    public function getTargetPath(): string
    {
        return $this->targetPath;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    /**
     * 转换为数组（用于 HTTP 请求）.
     */
    public function toArray(): array
    {
        return [
            'source_path' => $this->sourcePath,
            'target_path' => $this->targetPath,
            'action' => $this->action,
        ];
    }
}
