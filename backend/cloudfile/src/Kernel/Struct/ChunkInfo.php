<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use Throwable;

/**
 * 分片信息类.
 */
class ChunkInfo
{
    private int $partNumber;

    private int $start;

    private int $end;

    private int $size;

    private string $etag = '';

    private bool $uploaded = false;

    private int $retryCount = 0;

    private ?Throwable $lastError = null;

    public function __construct(int $partNumber, int $start, int $end, int $size)
    {
        $this->partNumber = $partNumber;
        $this->start = $start;
        $this->end = $end;
        $this->size = $size;
    }

    public function getPartNumber(): int
    {
        return $this->partNumber;
    }

    public function getStart(): int
    {
        return $this->start;
    }

    public function getEnd(): int
    {
        return $this->end;
    }

    public function getSize(): int
    {
        return $this->size;
    }

    public function getEtag(): string
    {
        return $this->etag;
    }

    public function setEtag(string $etag): void
    {
        $this->etag = $etag;
    }

    public function isUploaded(): bool
    {
        return $this->uploaded;
    }

    public function setUploaded(bool $uploaded): void
    {
        $this->uploaded = $uploaded;
    }

    public function getRetryCount(): int
    {
        return $this->retryCount;
    }

    public function incrementRetryCount(): void
    {
        ++$this->retryCount;
    }

    public function resetRetryCount(): void
    {
        $this->retryCount = 0;
    }

    public function getLastError(): ?Throwable
    {
        return $this->lastError;
    }

    public function setLastError(?Throwable $lastError): void
    {
        $this->lastError = $lastError;
    }

    /**
     * 标记为上传完成.
     */
    public function markAsCompleted(string $etag): void
    {
        $this->etag = $etag;
        $this->uploaded = true;
        $this->lastError = null;
    }

    /**
     * 标记为上传失败.
     */
    public function markAsFailed(Throwable $error): void
    {
        $this->uploaded = false;
        $this->lastError = $error;
        $this->incrementRetryCount();
    }

    /**
     * 转为数组.
     */
    public function toArray(): array
    {
        return [
            'part_number' => $this->partNumber,
            'start' => $this->start,
            'end' => $this->end,
            'size' => $this->size,
            'etag' => $this->etag,
            'uploaded' => $this->uploaded,
            'retry_count' => $this->retryCount,
        ];
    }

    /**
     * 从数组创建.
     */
    public static function fromArray(array $data): self
    {
        $chunk = new self(
            $data['part_number'],
            $data['start'],
            $data['end'],
            $data['size']
        );

        $chunk->setEtag($data['etag'] ?? '');
        $chunk->setUploaded($data['uploaded'] ?? false);
        $chunk->retryCount = $data['retry_count'] ?? 0;

        return $chunk;
    }

    /**
     * 创建用于TOS CompleteMultipartUpload的Part格式.
     */
    public function toCompletePart(): array
    {
        return [
            'PartNumber' => $this->partNumber,
            'ETag' => $this->etag,
        ];
    }
}
