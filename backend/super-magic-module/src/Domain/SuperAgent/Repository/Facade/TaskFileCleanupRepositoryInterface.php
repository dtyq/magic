<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

interface TaskFileCleanupRepositoryInterface
{
    /**
     * Get all statistics in one query (optimized).
     * @param null|int $projectId Filter by project ID
     * @param null|string $fileKey Filter by specific file_key
     */
    public function getAllStatistics(?int $projectId = null, ?string $fileKey = null): array;

    /**
     * Count fully deleted duplicate file_keys.
     */
    public function countFullyDeletedDuplicates(): int;

    /**
     * Count duplicate directory file_keys.
     */
    public function countDirectoryDuplicates(): int;

    /**
     * Count duplicate file file_keys.
     */
    public function countFileDuplicates(): int;

    /**
     * Get fully deleted duplicate file_keys with pagination.
     * @param null|int $projectId Filter by project ID
     * @param null|string $fileKey Filter by specific file_key
     */
    public function getFullyDeletedDuplicateKeys(int $limit, int $offset, ?int $projectId = null, ?string $fileKey = null): array;

    /**
     * Get duplicate directory file_keys with pagination.
     * @param null|int $projectId Filter by project ID
     * @param null|string $fileKey Filter by specific file_key
     */
    public function getDirectoryDuplicateKeys(int $limit, int $offset, ?int $projectId = null, ?string $fileKey = null): array;

    /**
     * Get duplicate file file_keys with pagination.
     * @param null|int $projectId Filter by project ID
     * @param null|string $fileKey Filter by specific file_key
     */
    public function getFileDuplicateKeys(int $limit, int $offset, ?int $projectId = null, ?string $fileKey = null): array;

    /**
     * Get all records by file_key, ordered by priority.
     */
    public function getRecordsByFileKey(string $fileKey): array;

    /**
     * Get all records for multiple file_keys, ordered by priority (optimized batch query).
     */
    public function getRecordsByFileKeys(array $fileKeys): array;

    /**
     * Update parent_id references for deleted file IDs.
     */
    public function updateParentIdReferences(int $keptFileId, array $deletedFileIds, int $projectId): int;

    /**
     * Delete records by file IDs.
     */
    public function deleteRecords(array $fileIds): int;

    /**
     * Count remaining duplicate file_keys.
     */
    public function countRemainingDuplicates(): int;

    /**
     * Get file_keys with inconsistent is_directory values.
     * Returns array of ['file_key' => string, 'is_directory_values' => string (e.g. "0,1")].
     */
    public function getInconsistentDirectoryFlags(): array;

    /**
     * Fix is_directory flag for all records of a file_key.
     */
    public function fixDirectoryFlag(string $fileKey, int $correctIsDirectory): int;
}
