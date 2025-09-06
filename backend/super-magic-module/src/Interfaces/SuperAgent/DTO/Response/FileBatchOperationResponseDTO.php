<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * File batch operation response DTO.
 *
 * Used for unified response format when creating batch operations (rename, delete, move, etc.)
 * Supports both synchronous and asynchronous processing results.
 */
class FileBatchOperationResponseDTO
{
    /**
     * Constructor.
     *
     * @param string $batchKey Batch key (empty for sync, non-empty for async)
     * @param string $status Operation status (success|processing|failed)
     * @param mixed $files File information (object for sync result, empty object for async)
     */
    public function __construct(
        private readonly string $batchKey,
        private readonly string $status,
        private readonly mixed $files
    ) {
    }

    /**
     * Create sync response for successful operation.
     *
     * @param mixed $files File information result
     */
    public static function createSyncSuccess(mixed $files): self
    {
        return new self('', 'success', $files);
    }

    /**
     * Create async response for processing operation.
     *
     * @param string $batchKey Batch key for status tracking
     */
    public static function createAsyncProcessing(string $batchKey): self
    {
        return new self($batchKey, 'processing', (object) []);
    }

    /**
     * Create sync response for failed operation.
     *
     * @param string $errorMessage Error message
     */
    public static function createSyncFailed(string $errorMessage = ''): self
    {
        return new self('', 'failed', (object) ['error' => $errorMessage]);
    }

    /**
     * Convert to array for API response.
     */
    public function toArray(): array
    {
        return [
            'batch_key' => $this->batchKey,
            'status' => $this->status,
            'files' => $this->files,
        ];
    }

    /**
     * Get batch key.
     */
    public function getBatchKey(): string
    {
        return $this->batchKey;
    }

    /**
     * Get operation status.
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * Get files information.
     */
    public function getFiles(): mixed
    {
        return $this->files;
    }

    /**
     * Check if this is an async operation.
     */
    public function isAsync(): bool
    {
        return ! empty($this->batchKey);
    }

    /**
     * Check if this is a sync operation.
     */
    public function isSync(): bool
    {
        return empty($this->batchKey);
    }

    /**
     * Check if operation was successful.
     */
    public function isSuccess(): bool
    {
        return $this->status === 'success';
    }

    /**
     * Check if operation is processing.
     */
    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    /**
     * Check if operation failed.
     */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }
}
