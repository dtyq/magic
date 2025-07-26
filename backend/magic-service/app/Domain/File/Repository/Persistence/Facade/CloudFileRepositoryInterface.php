<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Repository\Persistence\Facade;

use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;

interface CloudFileRepositoryInterface
{
    /**
     * @return array<string,FileLink>
     */
    public function getLinks(string $organizationCode, array $filePaths, ?StorageBucketType $bucketType = null, array $downloadNames = [], array $options = []): array;

    public function uploadByCredential(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null): void;

    /**
     * Upload file by chunks.
     *
     * @param string $organizationCode Organization code
     * @param ChunkUploadFile $chunkUploadFile Chunk upload file object
     * @param StorageBucketType $storage Storage bucket type
     * @param bool $autoDir Whether to auto-generate directory
     */
    public function uploadByChunks(string $organizationCode, ChunkUploadFile $chunkUploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void;

    public function upload(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void;

    public function getSimpleUploadTemporaryCredential(string $organizationCode, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null, bool $sts = false): array;

    /**
     * Download file using chunk download.
     *
     * @param string $organizationCode Organization code
     * @param string $filePath Remote file path
     * @param string $localPath Local save path
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (chunk_size, max_concurrency, etc.)
     */
    public function downloadByChunks(string $organizationCode, string $filePath, string $localPath, ?StorageBucketType $bucketType = null, array $options = []): void;

    public function getStsTemporaryCredential(
        string $organizationCode,
        StorageBucketType $bucketType = StorageBucketType::Private,
        string $dir = '',
        int $expires = 7200
    ): array;

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(string $organizationCode, array $fileNames, int $expires = 3600, StorageBucketType $bucketType = StorageBucketType::Private): array;

    public function getMetas(array $paths, string $organizationCode): array;

    public function getDefaultIconPaths(string $appId = 'open'): array;

    /**
     * Delete file from storage.
     *
     * @param string $organizationCode Organization code
     * @param string $filePath File path to delete
     * @param StorageBucketType $bucketType Storage bucket type
     * @return bool True if deleted successfully, false otherwise
     */
    public function deleteFile(string $organizationCode, string $filePath, StorageBucketType $bucketType = StorageBucketType::Private): bool;

    public function getFullPrefix(string $organizationCode): string;

    public function generateWorkDir(string $userId, int $projectId, string $code, string $lastPath): string;
}
