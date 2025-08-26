<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * File batch operation status response DTO.
 *
 * Used for querying batch operation status and progress.
 * Supports all file batch operations (rename, delete, move, copy).
 */
class FileBatchOperationStatusResponseDTO
{
    /**
     * Constructor.
     *
     * @param string $status Task status (processing|success|failed|not_found)
     * @param string $operation Operation type (rename|delete|move|copy)
     * @param int $progress Progress percentage (0-100)
     * @param string $message Status message
     * @param int $current Current processed items
     * @param int $total Total items to process
     * @param array $files Operation files data
     */
    public function __construct(
        private readonly string $status,
        private readonly string $operation = '',
        private readonly int $progress = 0,
        private readonly string $message = '',
        private readonly int $current = 0,
        private readonly int $total = 0,
        private readonly array $files = []
    ) {
    }

    /**
     * Create status response for processing task.
     *
     * @param string $operation Operation type
     * @param int $progress Progress percentage
     * @param string $message Progress message
     * @param int $current Current processed items
     * @param int $total Total items
     * @param array $files Operation files data
     */
    public static function createProcessing(
        string $operation,
        int $progress,
        string $message = '',
        int $current = 0,
        int $total = 0,
        array $files = []
    ): self {
        return new self('processing', $operation, $progress, $message, $current, $total, $files);
    }

    /**
     * Create status response for successful task.
     *
     * @param string $operation Operation type
     * @param string $message Success message
     * @param array $files Operation files data
     */
    public static function createSuccess(
        string $operation,
        string $message = '',
        array $files = []
    ): self {
        return new self('success', $operation, 100, $message, 0, 0, $files);
    }

    /**
     * Create status response for failed task.
     *
     * @param string $operation Operation type
     * @param string $message Error message
     * @param array $files Operation files data
     */
    public static function createFailed(
        string $operation,
        string $message = '',
        array $files = []
    ): self {
        return new self('failed', $operation, 0, $message, 0, 0, $files);
    }

    /**
     * Create status response for not found task.
     *
     * @param string $message Not found message
     */
    public static function createNotFound(string $message = 'Task not found or expired'): self
    {
        return new self('not_found', '', 0, $message, 0, 0, []);
    }

    /**
     * Create from task status data.
     *
     * @param array $taskStatus Task status data from status manager
     */
    public static function fromTaskStatus(array $taskStatus): self
    {
        $progress = $taskStatus['progress'] ?? [];

        return new self(
            $taskStatus['status'] ?? 'not_found',
            $taskStatus['operation'] ?? '',
            (int) ($progress['percentage'] ?? 0),
            $progress['message'] ?? $taskStatus['message'] ?? '',
            (int) ($progress['current'] ?? 0),
            (int) ($progress['total'] ?? 0),
            $taskStatus['files'] ?? []
        );
    }

    /**
     * Convert to array for API response.
     */
    public function toArray(): array
    {
        $result = [
            'status' => $this->status,
            'progress' => $this->progress,
            'message' => $this->message,
        ];

        // Add operation info for valid operations
        if (! empty($this->operation)) {
            $result['operation'] = $this->operation;
        }

        // Add progress details for processing/completed tasks
        if ($this->status !== 'not_found' && $this->total > 0) {
            $result['current'] = $this->current;
            $result['total'] = $this->total;
        }

        // Add files if present
        if (! empty($this->files)) {
            $result['files'] = $this->files;
        }

        return $result;
    }

    /**
     * Get task status.
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * Get operation type.
     */
    public function getOperation(): string
    {
        return $this->operation;
    }

    /**
     * Get progress percentage.
     */
    public function getProgress(): int
    {
        return $this->progress;
    }

    /**
     * Get status message.
     */
    public function getMessage(): string
    {
        return $this->message;
    }

    /**
     * Get current processed items.
     */
    public function getCurrent(): int
    {
        return $this->current;
    }

    /**
     * Get total items to process.
     */
    public function getTotal(): int
    {
        return $this->total;
    }

    /**
     * Get operation files data.
     */
    public function getFiles(): array
    {
        return $this->files;
    }

    /**
     * Check if task is processing.
     */
    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    /**
     * Check if task is successful.
     */
    public function isSuccess(): bool
    {
        return $this->status === 'success';
    }

    /**
     * Check if task is failed.
     */
    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    /**
     * Check if task is not found.
     */
    public function isNotFound(): bool
    {
        return $this->status === 'not_found';
    }

    /**
     * Check if task is completed (success or failed).
     */
    public function isCompleted(): bool
    {
        return in_array($this->status, ['success', 'failed'], true);
    }

    /**
     * Get progress as formatted string.
     */
    public function getProgressString(): string
    {
        if ($this->total > 0) {
            return "{$this->current}/{$this->total} ({$this->progress}%)";
        }

        return "{$this->progress}%";
    }
}
