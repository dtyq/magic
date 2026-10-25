<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config;

/**
 * ASR 音频配置
 * 用于 finishTask 接口的音频合并配置.
 */
readonly class AsrAudioConfig
{
    /**
     * @param string $sourceDir 音频分片源目录（相对于 workspace）
     * @param string $targetDir 目标目录（相对于 workspace）
     * @param string $outputFilename 输出文件名（不含扩展名）
     * @param null|int $fileShardCount 已上传音频分片总数
     */
    public function __construct(
        private string $sourceDir,
        private string $targetDir,
        private string $outputFilename,
        private ?int $fileShardCount = null
    ) {
    }

    public function getSourceDir(): string
    {
        return $this->sourceDir;
    }

    public function getTargetDir(): string
    {
        return $this->targetDir;
    }

    public function getOutputFilename(): string
    {
        return $this->outputFilename;
    }

    public function getFileShardCount(): ?int
    {
        return $this->fileShardCount;
    }

    /**
     * 转换为数组（用于 HTTP 请求）.
     */
    public function toArray(): array
    {
        $data = [
            'source_dir' => $this->sourceDir,
            'target_dir' => $this->targetDir,
            'output_filename' => $this->outputFilename,
        ];

        if ($this->fileShardCount !== null && $this->fileShardCount > 0) {
            $data['file_shard_count'] = $this->fileShardCount;
        }

        return $data;
    }
}
