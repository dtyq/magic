<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Struct;

use DateTime;

/**
 * Chunk download file class.
 */
class ChunkDownloadFile
{
    private string $remoteFilePath;

    private string $localFilePath;

    private int $fileSize;

    private ChunkDownloadConfig $chunkConfig;

    private ?ChunkProgressCallback $progressCallback = null;

    /**
     * @var ChunkDownloadInfo[] Chunk information list
     */
    private array $chunks = [];

    private string $downloadId = '';

    private DateTime $createdAt;

    public function __construct(
        string $remoteFilePath,
        string $localFilePath,
        int $fileSize,
        ?ChunkDownloadConfig $chunkConfig = null
    ) {
        $this->remoteFilePath = $remoteFilePath;
        $this->localFilePath = $localFilePath;
        $this->fileSize = $fileSize;
        $this->chunkConfig = $chunkConfig ?? new ChunkDownloadConfig();
        $this->downloadId = uniqid('download_');
        $this->createdAt = new DateTime();
    }

    public function getRemoteFilePath(): string
    {
        return $this->remoteFilePath;
    }

    public function getLocalFilePath(): string
    {
        return $this->localFilePath;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function setFileSize(int $fileSize): void
    {
        $this->fileSize = $fileSize;
    }

    public function getChunkConfig(): ChunkDownloadConfig
    {
        return $this->chunkConfig;
    }

    public function setChunkConfig(ChunkDownloadConfig $chunkConfig): void
    {
        $this->chunkConfig = $chunkConfig;
    }

    public function getProgressCallback(): ?ChunkProgressCallback
    {
        return $this->progressCallback;
    }

    public function setProgressCallback(?ChunkProgressCallback $progressCallback): void
    {
        $this->progressCallback = $progressCallback;
    }

    public function getDownloadId(): string
    {
        return $this->downloadId;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    /**
     * @return ChunkDownloadInfo[]
     */
    public function getChunks(): array
    {
        return $this->chunks;
    }

    /**
     * @param ChunkDownloadInfo[] $chunks
     */
    public function setChunks(array $chunks): void
    {
        $this->chunks = $chunks;
    }

    public function addChunk(ChunkDownloadInfo $chunk): void
    {
        $this->chunks[] = $chunk;
    }

    /**
     * Calculate chunk information.
     */
    public function calculateChunks(): void
    {
        $chunkSize = $this->chunkConfig->getChunkSize();

        $chunks = [];
        $chunkCount = (int) ceil($this->fileSize / $chunkSize);

        for ($i = 0; $i < $chunkCount; ++$i) {
            $partNumber = $i + 1;
            $start = $i * $chunkSize;
            $end = min($start + $chunkSize - 1, $this->fileSize - 1);
            $size = $end - $start + 1;

            $chunk = new ChunkDownloadInfo($partNumber, $start, $end, $size);

            // Set temporary file path
            $tempDir = $this->chunkConfig->getTempDir();
            $tempFile = $tempDir . DIRECTORY_SEPARATOR . $this->downloadId . '_part_' . $partNumber;
            $chunk->setTempFilePath($tempFile);

            $chunks[] = $chunk;
        }

        $this->chunks = $chunks;
    }

    /**
     * Check if chunk download should be used.
     */
    public function shouldUseChunkDownload(): bool
    {
        return $this->fileSize > $this->chunkConfig->getThreshold();
    }

    /**
     * Get completed chunks count.
     */
    public function getCompletedChunksCount(): int
    {
        return count(array_filter($this->chunks, fn ($chunk) => $chunk->isDownloaded()));
    }

    /**
     * Get total downloaded bytes.
     */
    public function getTotalDownloadedBytes(): int
    {
        return array_sum(array_map(fn ($chunk) => $chunk->getDownloadedBytes(), $this->chunks));
    }

    /**
     * Check if download is complete.
     */
    public function isDownloadComplete(): bool
    {
        return $this->getCompletedChunksCount() === count($this->chunks);
    }

    /**
     * Get download progress percentage.
     */
    public function getProgressPercentage(): float
    {
        if ($this->fileSize === 0) {
            return 0.0;
        }

        return ($this->getTotalDownloadedBytes() / $this->fileSize) * 100;
    }

    /**
     * Trigger progress callback.
     */
    public function triggerProgress(): void
    {
        if ($this->progressCallback) {
            $this->progressCallback->onProgress(
                $this->getCompletedChunksCount(),
                count($this->chunks),
                $this->getTotalDownloadedBytes(),
                $this->fileSize
            );
        }
    }

    /**
     * Get temporary chunks directory.
     */
    public function getChunksDirectory(): string
    {
        return $this->chunkConfig->getTempDir() . DIRECTORY_SEPARATOR . $this->downloadId . '_chunks';
    }

    /**
     * Create temporary chunks directory.
     */
    public function createChunksDirectory(): string
    {
        $dir = $this->getChunksDirectory();
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    /**
     * Clean up temporary files.
     */
    public function cleanupTempFiles(): void
    {
        // Clean up individual chunk files
        foreach ($this->chunks as $chunk) {
            $tempFile = $chunk->getTempFilePath();
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }

        // Clean up chunks directory
        $chunksDir = $this->getChunksDirectory();
        if (is_dir($chunksDir)) {
            rmdir($chunksDir);
        }
    }

    /**
     * Convert to array (for resume download persistence).
     */
    public function toArray(): array
    {
        return [
            'remote_file_path' => $this->remoteFilePath,
            'local_file_path' => $this->localFilePath,
            'file_size' => $this->fileSize,
            'download_id' => $this->downloadId,
            'created_at' => $this->createdAt->format('Y-m-d H:i:s'),
            'chunk_config' => $this->chunkConfig->toArray(),
            'chunks' => array_map(fn ($chunk) => $chunk->toArray(), $this->chunks),
        ];
    }

    /**
     * Create from array (for resume download recovery).
     */
    public static function fromArray(array $data): self
    {
        $file = new self(
            $data['remote_file_path'],
            $data['local_file_path'],
            $data['file_size'],
            ChunkDownloadConfig::fromArray($data['chunk_config'] ?? [])
        );

        $file->downloadId = $data['download_id'] ?? uniqid('download_');
        $file->createdAt = new DateTime($data['created_at'] ?? 'now');

        // Restore chunk information
        if (! empty($data['chunks'])) {
            $chunks = array_map(fn ($chunkData) => ChunkDownloadInfo::fromArray($chunkData), $data['chunks']);
            $file->setChunks($chunks);
        }

        return $file;
    }
}
