<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use InvalidArgumentException;

/**
 * Chunk download configuration class.
 */
class ChunkDownloadConfig
{
    /**
     * Chunk size in bytes
     * Default 2MB (smaller chunks for better download network efficiency).
     */
    private int $chunkSize;

    /**
     * Chunk download threshold in bytes
     * Files larger than this size will use chunk download
     * Default 10MB.
     */
    private int $threshold;

    /**
     * Maximum concurrent chunks
     * Default 3.
     */
    private int $maxConcurrency;

    /**
     * Maximum retry attempts
     * Default 3.
     */
    private int $maxRetries;

    /**
     * Retry delay in milliseconds
     * Default 1000ms.
     */
    private int $retryDelay;

    /**
     * Timeout in seconds
     * Default 60 seconds (timeout for downloading single chunk).
     */
    private int $timeout;

    /**
     * Enable resume download
     * Default true.
     */
    private bool $enableResume;

    /**
     * Temporary file directory
     * Use system temp directory if empty.
     */
    private string $tempDir;

    /**
     * Platform type for chunk download
     * If specified, will use this platform instead of current adapter
     * Useful for FileService to delegate to actual storage platform.
     */
    private ?string $platform;

    public function __construct(
        int $chunkSize = 2 * 1024 * 1024,   // 2MB
        int $threshold = 10 * 1024 * 1024,  // 10MB
        int $maxConcurrency = 3,
        int $maxRetries = 3,
        int $retryDelay = 1000,
        int $timeout = 60,
        bool $enableResume = true,
        string $tempDir = '',
        ?string $platform = null
    ) {
        $this->setChunkSize($chunkSize);
        $this->setThreshold($threshold);
        $this->setMaxConcurrency($maxConcurrency);
        $this->setMaxRetries($maxRetries);
        $this->setRetryDelay($retryDelay);
        $this->setTimeout($timeout);
        $this->setEnableResume($enableResume);
        $this->setTempDir($tempDir);
        $this->setPlatform($platform);
    }

    public function getChunkSize(): int
    {
        return $this->chunkSize;
    }

    public function setChunkSize(int $chunkSize): void
    {
        if ($chunkSize < 1024 * 1024) { // minimum 1MB
            throw new InvalidArgumentException('Download chunk size must be at least 1MB');
        }
        if ($chunkSize > 100 * 1024 * 1024) { // maximum 100MB
            throw new InvalidArgumentException('Download chunk size must not exceed 100MB');
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

    public function isEnableResume(): bool
    {
        return $this->enableResume;
    }

    public function setEnableResume(bool $enableResume): void
    {
        $this->enableResume = $enableResume;
    }

    public function getTempDir(): string
    {
        return $this->tempDir ?: sys_get_temp_dir();
    }

    public function setTempDir(string $tempDir): void
    {
        $this->tempDir = $tempDir;
    }

    public function getPlatform(): ?string
    {
        return $this->platform;
    }

    public function setPlatform(?string $platform): void
    {
        $this->platform = $platform;
    }

    /**
     * Create default configuration.
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * Create from configuration array.
     */
    public static function fromArray(array $config): self
    {
        return new self(
            $config['chunk_size'] ?? 2 * 1024 * 1024,
            $config['threshold'] ?? 10 * 1024 * 1024,
            $config['max_concurrency'] ?? 3,
            $config['max_retries'] ?? 3,
            $config['retry_delay'] ?? 1000,
            $config['timeout'] ?? 60,
            $config['enable_resume'] ?? true,
            $config['temp_dir'] ?? '',
            $config['platform'] ?? null
        );
    }

    /**
     * Convert to array.
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
            'enable_resume' => $this->enableResume,
            'temp_dir' => $this->tempDir,
            'platform' => $this->platform,
        ];
    }
}
