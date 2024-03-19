<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use InvalidArgumentException;

/**
 * 分片上传配置类.
 */
class ChunkUploadConfig
{
    /**
     * 分片大小（字节）
     * 默认10MB.
     */
    private int $chunkSize;

    /**
     * 分片上传阈值（字节）
     * 文件大小超过此值时使用分片上传
     * 默认20MB.
     */
    private int $threshold;

    /**
     * 最大并发分片数
     * 默认3个.
     */
    private int $maxConcurrency;

    /**
     * 最大重试次数
     * 默认3次
     */
    private int $maxRetries;

    /**
     * 重试延迟（毫秒）
     * 默认1000ms.
     */
    private int $retryDelay;

    /**
     * 超时时间（秒）
     * 默认300秒（5分钟）.
     */
    private int $timeout;

    public function __construct(
        int $chunkSize = 10 * 1024 * 1024,  // 10MB
        int $threshold = 20 * 1024 * 1024, // 20MB
        int $maxConcurrency = 3,
        int $maxRetries = 3,
        int $retryDelay = 1000,
        int $timeout = 300
    ) {
        $this->setChunkSize($chunkSize);
        $this->setThreshold($threshold);
        $this->setMaxConcurrency($maxConcurrency);
        $this->setMaxRetries($maxRetries);
        $this->setRetryDelay($retryDelay);
        $this->setTimeout($timeout);
    }

    public function getChunkSize(): int
    {
        return $this->chunkSize;
    }

    public function setChunkSize(int $chunkSize): void
    {
        if ($chunkSize < 5 * 1024 * 1024) { // 最小5MB
            throw new InvalidArgumentException('Chunk size must be at least 5MB');
        }
        if ($chunkSize > 1 * 1024 * 1024 * 1024) { // 最大1GB
            throw new InvalidArgumentException('Chunk size must not exceed 1GB');
        }
        $this->chunkSize = $chunkSize;
    }

    public function getThreshold(): int
    {
        return $this->threshold;
    }

    public function setThreshold(int $threshold): void
    {
        if ($threshold < 0) {
            throw new InvalidArgumentException('Threshold must be non-negative');
        }
        $this->threshold = $threshold;
    }

    public function getMaxConcurrency(): int
    {
        return $this->maxConcurrency;
    }

    public function setMaxConcurrency(int $maxConcurrency): void
    {
        if ($maxConcurrency < 1) {
            throw new InvalidArgumentException('Max concurrency must be at least 1');
        }
        if ($maxConcurrency > 10) {
            throw new InvalidArgumentException('Max concurrency should not exceed 10');
        }
        $this->maxConcurrency = $maxConcurrency;
    }

    public function getMaxRetries(): int
    {
        return $this->maxRetries;
    }

    public function setMaxRetries(int $maxRetries): void
    {
        if ($maxRetries < 0) {
            throw new InvalidArgumentException('Max retries must be non-negative');
        }
        $this->maxRetries = $maxRetries;
    }

    public function getRetryDelay(): int
    {
        return $this->retryDelay;
    }

    public function setRetryDelay(int $retryDelay): void
    {
        if ($retryDelay < 0) {
            throw new InvalidArgumentException('Retry delay must be non-negative');
        }
        $this->retryDelay = $retryDelay;
    }

    public function getTimeout(): int
    {
        return $this->timeout;
    }

    public function setTimeout(int $timeout): void
    {
        if ($timeout < 1) {
            throw new InvalidArgumentException('Timeout must be at least 1 second');
        }
        $this->timeout = $timeout;
    }

    /**
     * 创建默认配置.
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * 从配置数组创建.
     */
    public static function fromArray(array $config): self
    {
        return new self(
            $config['chunk_size'] ?? 10 * 1024 * 1024,
            $config['threshold'] ?? 20 * 1024 * 1024,
            $config['max_concurrency'] ?? 1,
            $config['max_retries'] ?? 3,
            $config['retry_delay'] ?? 1000,
            $config['timeout'] ?? 300
        );
    }

    /**
     * 转为数组.
     */
    public function toArray(): array
    {
        return [
            'chunk_size' => $this->chunkSize,
            'threshold' => $this->threshold,
            'max_concurrency' => $this->maxConcurrency,
            'max_retries' => $this->maxRetries,
            'retry_delay' => $this->retryDelay,
            'timeout' => $this->timeout,
        ];
    }
}
