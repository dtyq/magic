<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config;

/**
 * ASR 流式识别文件配置
 * 用于 finishTask 接口的流式识别文件处理配置.
 */
readonly class AsrTranscriptFileConfig
{
    /**
     * @param string $sourcePath 源文件路径（相对于 workspace）
     * @param string $action 操作类型（delete - 直接删除）
     */
    public function __construct(
        private string $sourcePath,
        private string $action = 'delete'
    ) {
    }

    public function getSourcePath(): string
    {
        return $this->sourcePath;
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
            'action' => $this->action,
        ];
    }
}
