<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use Throwable;

/**
 * Chunk download information class.
 */
class ChunkDownloadInfo
{
    private int $partNumber;

    private int $start;

    private int $end;

    private int $size;

    private bool $downloaded = false;

    private int $retryCount = 0;

    private ?Throwable $lastError = null;

    private string $tempFilePath = '';

    private int $downloadedBytes = 0;

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

    public function isDownloaded(): bool
    {
        return $this->downloaded;
    }

    public function setDownloaded(bool $downloaded): void
    {
        $this->downloaded = $downloaded;
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

    public function getTempFilePath(): string
    {
        return $this->tempFilePath;
    }

    public function setTempFilePath(string $tempFilePath): void
    {
        $this->tempFilePath = $tempFilePath;
    }

    public function getDownloadedBytes(): int
    {
        return $this->downloadedBytes;
    }

    public function setDownloadedBytes(int $downloadedBytes): void
    {
        $this->downloadedBytes = $downloadedBytes;
    }

    /**
     * Get HTTP Range header.
     */
    public function getRangeHeader(): string
    {
        return "bytes={$this->start}-{$this->end}";
    }

    /**
     * Mark as download completed.
     */
    public function markAsCompleted(): void
    {
        $this->downloaded = true;
        $this->downloadedBytes = $this->size;
        $this->lastError = null;
    }

    /**
     * Mark as download failed.
     */
    public function markAsFailed(Throwable $error): void
    {
        $this->downloaded = false;
        $this->lastError = $error;
        $this->incrementRetryCount();
    }

    /**
     * Update download progress.
     */
    public function updateProgress(int $downloadedBytes): void
    {
        $this->downloadedBytes = min($downloadedBytes, $this->size);
    }

    /**
     * Check if partially downloaded (for resume download).
     */
    public function isPartiallyDownloaded(): bool
    {
        return $this->downloadedBytes > 0 && $this->downloadedBytes < $this->size;
    }

    /**
     * Get remaining range to download (for resume download).
     */
    public function getRemainingRange(): ?string
    {
        if (! $this->isPartiallyDownloaded()) {
            return null;
        }

        $remainingStart = $this->start + $this->downloadedBytes;
        return "bytes={$remainingStart}-{$this->end}";
    }

    /**
     * Convert to array.
     */
    public function toArray(): array
    {
        return [
            'part_number' => $this->partNumber,
            'start' => $this->start,
            'end' => $this->end,
            'size' => $this->size,
            'downloaded' => $this->downloaded,
            'retry_count' => $this->retryCount,
            'temp_file_path' => $this->tempFilePath,
            'downloaded_bytes' => $this->downloadedBytes,
        ];
    }

    /**
     * Create from array.
     */
    public static function fromArray(array $data): self
    {
        $chunk = new self(
            $data['part_number'],
            $data['start'],
            $data['end'],
            $data['size']
        );

        $chunk->setDownloaded($data['downloaded'] ?? false);
        $chunk->retryCount = $data['retry_count'] ?? 0;
        $chunk->setTempFilePath($data['temp_file_path'] ?? '');
        $chunk->setDownloadedBytes($data['downloaded_bytes'] ?? 0);

        return $chunk;
    }
}
