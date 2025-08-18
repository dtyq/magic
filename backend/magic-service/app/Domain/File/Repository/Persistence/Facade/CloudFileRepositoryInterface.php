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
        int $expires = 3600,
        bool $autoBucket = true,
    ): array;

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(string $organizationCode, array $fileNames, int $expires = 3600, StorageBucketType $bucketType = StorageBucketType::Private): array;

    public function getMetas(array $paths, string $organizationCode, StorageBucketType $bucketType = StorageBucketType::Private): array;

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

    /**
     * List objects by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $prefix Object prefix to filter
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (marker, max-keys, delimiter, etc.)
     * @return array List of objects
     */
    public function listObjectsByCredential(
        string $organizationCode,
        string $prefix = '',
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): array;

    /**
     * Delete object by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to delete
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (version_id, etc.)
     */
    public function deleteObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Copy object by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $sourceKey Source object key
     * @param string $destinationKey Destination object key
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (source_bucket, source_version_id, metadata_directive, etc.)
     */
    public function copyObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $sourceKey,
        string $destinationKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Get object metadata by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to get metadata
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @return array Object metadata
     */
    public function getHeadObjectByCredential(
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): array;

    /**
     * Set object metadata by credential.
     *
     * @param string $organizationCode Organization code for data isolation
     * @param string $objectKey Object key to set metadata
     * @param array $metadata Metadata to set
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     */
    public function setHeadObjectByCredential(
        string $organizationCode,
        string $objectKey,
        array $metadata,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Create object by credential (file or folder).
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to create
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (content, content_type, etc.)
     */
    public function createObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Create folder by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $folderPath Folder path (will automatically add '/' if missing)
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     */
    public function createFolderByCredential(
        string $prefix,
        string $organizationCode,
        string $folderPath,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Create file by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $filePath File path
     * @param string $content File content (default empty)
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     */
    public function createFileByCredential(
        string $prefix,
        string $organizationCode,
        string $filePath,
        string $content = '',
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Rename object by credential.
     *
     * @param string $prefix Prefix for the operation
     * @param string $organizationCode Organization code
     * @param string $sourceKey Source object key
     * @param string $destinationKey Destination object key
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     */
    public function renameObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $sourceKey,
        string $destinationKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void;

    /**
     * Generate pre-signed URL by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to generate URL for
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (method, expires, filename, etc.)
     * @return string Pre-signed URL
     */
    public function getPreSignedUrlByCredential(
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): string;

    /**
     * Delete multiple objects by credential.
     *
     * @param string $prefix Prefix for the operation
     * @param string $organizationCode Organization code for data isolation
     * @param array $objectKeys Array of object keys to delete
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @return array Delete result with success and error information
     */
    public function deleteObjectsByCredential(
        string $prefix,
        string $organizationCode,
        array $objectKeys,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): array;

    public function getFullPrefix(string $organizationCode): string;

    public function generateWorkDir(string $userId, int $projectId, string $code, string $lastPath): string;
}
