<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Event;

use App\Infrastructure\Core\ValueObject\StorageBucketType;

/**
 * File batch compression event.
 */
class FileBatchCompressEvent
{
    /**
     * Constructor.
     *
     * @param string $source Source of the request (default: super_magic)
     * @param string $organizationCode Organization code
     * @param string $userId User ID who initiated the batch compression
     * @param string $cacheKey Cache key for the batch task
     * @param array $files Array of files to compress (format: ['file_id' => ['file_key' => '...', 'file_name' => '...']])
     * @param string $workdir Working directory for compression
     * @param string $targetName Target file name for the compressed file
     * @param string $targetPath Target path for the compressed file
     * @param StorageBucketType $bucketType Storage bucket type for the compression
     */
    public function __construct(
        private readonly string $source,
        private readonly string $organizationCode,
        private readonly string $userId,
        private readonly string $cacheKey,
        private readonly array $files,
        private readonly string $workdir,
        private readonly string $targetName,
        private readonly string $targetPath,
        private readonly StorageBucketType $bucketType,
    ) {
    }

    /**
     * Create event from array data.
     *
     * @param array $data Event data array
     */
    public static function fromArray(array $data): self
    {
        return new self(
            source: $data['source'] ?? 'super_magic',
            organizationCode: $data['organization_code'] ?? '',
            userId: (string) ($data['user_id'] ?? '0'),
            cacheKey: $data['cache_key'] ?? '',
            files: $data['files'] ?? [],
            workdir: $data['workdir'] ?? '',
            targetName: $data['target_name'] ?? '',
            targetPath: $data['target_path'] ?? '',
            bucketType: isset($data['bucket_type']) ? StorageBucketType::from($data['bucket_type']) : StorageBucketType::Private,
        );
    }

    /**
     * Convert to array.
     *
     * @return array Event data array
     */
    public function toArray(): array
    {
        return [
            'source' => $this->source,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'cache_key' => $this->cacheKey,
            'files' => $this->files,
            'workdir' => $this->workdir,
            'target_name' => $this->targetName,
            'target_path' => $this->targetPath,
            'bucket_type' => $this->bucketType->value,
        ];
    }

    /**
     * Get source.
     */
    public function getSource(): string
    {
        return $this->source;
    }

    /**
     * Get organization code.
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * Get user ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * Get cache key.
     */
    public function getCacheKey(): string
    {
        return $this->cacheKey;
    }

    /**
     * Get files array.
     *
     * @return array Format: ['file_id' => ['file_key' => '...', 'file_name' => '...']]
     */
    public function getFiles(): array
    {
        return $this->files;
    }

    /**
     * Get working directory.
     */
    public function getWorkdir(): string
    {
        return $this->workdir;
    }

    /**
     * Get target name.
     */
    public function getTargetName(): string
    {
        return $this->targetName;
    }

    /**
     * Get target path.
     */
    public function getTargetPath(): string
    {
        return $this->targetPath;
    }

    /**
     * Get bucket type.
     */
    public function getBucketType(): StorageBucketType
    {
        return $this->bucketType;
    }
}
