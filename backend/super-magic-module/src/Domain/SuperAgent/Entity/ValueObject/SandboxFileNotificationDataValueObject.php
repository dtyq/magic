<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Sandbox file notification data value object.
 */
class SandboxFileNotificationDataValueObject
{
    /**
     * Constructor.
     *
     * @param int $timestamp File operation timestamp
     * @param string $operation File operation type (CREATE, UPDATE, DELETE)
     * @param string $filePath Relative file path
     * @param int $fileSize File size in bytes
     * @param int $isDirectory Whether the path is a directory (1 for directory, 0 for file)
     */
    public function __construct(
        private int $timestamp,
        private string $operation,
        private string $filePath,
        private int $fileSize = 0,
        private int $isDirectory = 0
    ) {
    }

    /**
     * Create from array.
     *
     * @param array $data Data array
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['timestamp'] ?? time(),
            $data['operation'] ?? '',
            $data['file_path'] ?? '',
            $data['file_size'] ?? 0,
            $data['is_directory'] ?? 0
        );
    }

    /**
     * Convert to array.
     *
     * @return array Data array
     */
    public function toArray(): array
    {
        return [
            'timestamp' => $this->timestamp,
            'operation' => $this->operation,
            'file_path' => $this->filePath,
            'file_size' => $this->fileSize,
            'is_directory' => $this->isDirectory,
        ];
    }

    // Getters
    public function getTimestamp(): int
    {
        return $this->timestamp;
    }

    public function getOperation(): string
    {
        return $this->operation;
    }

    public function getFilePath(): string
    {
        return $this->filePath;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function getIsDirectory(): int
    {
        return $this->isDirectory;
    }

    /**
     * Check if operation is valid.
     */
    public function isValidOperation(): bool
    {
        return in_array($this->operation, ['CREATE', 'UPDATE', 'DELETE'], true);
    }

    /**
     * Check if it's a create operation.
     */
    public function isCreateOperation(): bool
    {
        return $this->operation === 'CREATE';
    }

    /**
     * Check if it's an update operation.
     */
    public function isUpdateOperation(): bool
    {
        return $this->operation === 'UPDATE';
    }

    /**
     * Check if it's a delete operation.
     */
    public function isDeleteOperation(): bool
    {
        return $this->operation === 'DELETE';
    }

    /**
     * Check if the path is a directory.
     */
    public function isDirectory(): bool
    {
        return $this->isDirectory === 1;
    }
}
