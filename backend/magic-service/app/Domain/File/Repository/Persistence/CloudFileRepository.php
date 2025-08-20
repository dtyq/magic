<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Repository\Persistence;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\CloudFile;
use Dtyq\CloudFile\Hyperf\CloudFileFactory;
use Dtyq\CloudFile\Kernel\FilesystemProxy;
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Stringable\Str;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class CloudFileRepository implements CloudFileRepositoryInterface
{
    public const string DEFAULT_ICON_ORGANIZATION_CODE = 'MAGIC';

    protected CloudFile $cloudFile;

    protected LoggerInterface $logger;

    public function __construct(
        CloudFileFactory $cloudFileFactory,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('FileDomainService');
        $this->cloudFile = $cloudFileFactory->create();
    }

    /**
     * @return array<string,FileLink>
     */
    public function getLinks(string $organizationCode, array $filePaths, ?StorageBucketType $bucketType = null, array $downloadNames = [], array $options = []): array
    {
        $filePaths = array_filter($filePaths);

        if ($bucketType === null) {
            // If no storage bucket, perform automatic classification
            $publicStorageKey = md5(StorageBucketType::Public->value);
            $publicFilePaths = [];

            $privateStorageKey = md5(StorageBucketType::Private->value);
            $privateFilePaths = [];
            foreach ($filePaths as $filePath) {
                /* @phpstan-ignore-next-line */
                if (empty($filePath)) {
                    continue;
                }
                if (Str::contains($filePath, $publicStorageKey)) {
                    $publicFilePaths[] = $filePath;
                } elseif (Str::contains($filePath, $privateStorageKey)) {
                    $privateFilePaths[] = $filePath;
                } else {
                    // Fallback to private bucket
                    $privateFilePaths[] = $filePath;
                }
            }
            return array_merge(
                $this->getLinks($organizationCode, $privateFilePaths, StorageBucketType::Private, $downloadNames, $options),
                $this->getLinks($organizationCode, $publicFilePaths, StorageBucketType::Public, $downloadNames, $options)
            );
        }

        $links = [];
        $paths = [];
        $defaultIconPaths = [];
        foreach ($filePaths as $filePath) {
            /* @phpstan-ignore-next-line */
            if (! is_string($filePath)) {
                continue;
            }
            /* @phpstan-ignore-next-line */
            if (empty($filePath)) {
                continue;
            }
            if ($this->isDefaultIconPath($filePath)) {
                $defaultIconPaths[] = $filePath;
                continue;
            }
            // If file doesn't start with organization code, ignore
            if (! Str::startsWith($filePath, $organizationCode)) {
                continue;
            }
            $paths[] = $filePath;
        }
        // Temporarily increase download link validity period
        $expires = 60 * 60 * 24;
        if (! empty($defaultIconPaths)) {
            $defaultIconLinks = $this->getFilesystem(StorageBucketType::Public->value)->getLinks($defaultIconPaths, [], $expires, $this->getOptions(self::DEFAULT_ICON_ORGANIZATION_CODE, $options));
            $links = array_merge($links, $defaultIconLinks);
        }
        if (empty($paths)) {
            return $links;
        }
        try {
            $otherLinks = $this->getFilesystem($bucketType->value)->getLinks($paths, $downloadNames, $expires, $this->getOptions($organizationCode, $options));
            $links = array_merge($links, $otherLinks);
        } catch (Throwable $throwable) {
            $this->logger->warning('GetLinksError', [
                'file_paths' => $filePaths,
                'error' => $throwable->getMessage(),
            ]);
        }
        return $links;
    }

    public function uploadByCredential(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null): void
    {
        $filesystem = $this->getFilesystem($storage->value);
        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'role_session_name' => 'magic',
            // Use configuration name in file path for automatic recognition when getting links later
            'dir' => $autoDir ? $organizationCode . '/open/' . md5($storage->value) : '',
            'content_type' => $contentType,
        ]);
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy, $this->getOptions($organizationCode));
    }

    /**
     * Upload file by chunks.
     *
     * @param string $organizationCode Organization code
     * @param ChunkUploadFile $chunkUploadFile Chunk upload file object
     * @param StorageBucketType $storage Storage bucket type
     * @param bool $autoDir Whether to auto-generate directory
     * @throws Throwable
     */
    public function uploadByChunks(string $organizationCode, ChunkUploadFile $chunkUploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void
    {
        $filesystem = $this->getFilesystem($storage->value);
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,  // Use STS mode for chunk upload
            'role_session_name' => 'magic',
            // Use organization code + storage hash in path for automatic link recognition
            'dir' => $autoDir ? $organizationCode . '/open/' . md5($storage->value) : '',
            'expires' => 3600, // STS credential valid for 1 hour, sufficient for chunk upload
        ]);

        try {
            $filesystem->uploadByChunks($chunkUploadFile, $credentialPolicy, $this->getOptions($organizationCode));

            $this->logger->info('chunk_upload_repository_success', [
                'organization_code' => $organizationCode,
                'file_key' => $chunkUploadFile->getKey(),
                'file_size' => $chunkUploadFile->getSize(),
                'upload_id' => $chunkUploadFile->getUploadId(),
                'storage' => $storage->value,
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('chunk_upload_repository_failed', [
                'organization_code' => $organizationCode,
                'file_path' => $chunkUploadFile->getKeyPath(),
                'file_size' => $chunkUploadFile->getSize(),
                'storage' => $storage->value,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }
    }

    /**
     * Download file using chunk download.
     *
     * @param string $organizationCode Organization code
     * @param string $filePath Remote file path
     * @param string $localPath Local save path
     * @param null|StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (chunk_size, max_concurrency, etc.)
     * @throws Throwable
     */
    public function downloadByChunks(string $organizationCode, string $filePath, string $localPath, ?StorageBucketType $bucketType = null, array $options = []): void
    {
        $bucketType = $bucketType ?? StorageBucketType::Private;
        $filesystem = $this->getFilesystem($bucketType->value);

        // Create chunk download config with options
        $config = ChunkDownloadConfig::fromArray([
            'chunk_size' => $options['chunk_size'] ?? 2 * 1024 * 1024,        // Default 2MB
            'threshold' => $options['threshold'] ?? 10 * 1024 * 1024,         // Default 10MB
            'max_concurrency' => $options['max_concurrency'] ?? 3,            // Default 3
            'max_retries' => $options['max_retries'] ?? 3,                    // Default 3 retries
            'retry_delay' => $options['retry_delay'] ?? 1000,                 // Default 1s delay
            'temp_dir' => $options['temp_dir'] ?? sys_get_temp_dir() . '/chunks',
            'enable_resume' => $options['enable_resume'] ?? true,
        ]);

        try {
            $filesystem->downloadByChunks($filePath, $localPath, $config, $this->getOptions($organizationCode));

            $this->logger->info('chunk_download_repository_success', [
                'organization_code' => $organizationCode,
                'file_path' => $filePath,
                'local_path' => $localPath,
                'file_size' => file_exists($localPath) ? filesize($localPath) : 0,
                'bucket_type' => $bucketType->value,
                'chunk_size' => $config->getChunkSize(),
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('chunk_download_repository_failed', [
                'organization_code' => $organizationCode,
                'file_path' => $filePath,
                'local_path' => $localPath,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
            ]);
            throw $exception;
        }
    }

    public function upload(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void
    {
        $filesystem = $this->getFilesystem($storage->value);
        $filesystem->upload($uploadFile, $this->getOptions($organizationCode));
    }

    public function getSimpleUploadTemporaryCredential(string $organizationCode, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null, bool $sts = false): array
    {
        $filesystem = $this->getFilesystem($storage->value);
        $credentialPolicy = new CredentialPolicy([
            'sts' => $sts,
            'role_session_name' => 'magic',
            // Use configuration name in file path for automatic recognition when getting links later
            'dir' => $autoDir ? $organizationCode . '/open/' . md5($storage->value) : '',
            'content_type' => $contentType,
        ]);
        return $filesystem->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($organizationCode));
    }

    public function getStsTemporaryCredential(
        string $organizationCode,
        StorageBucketType $bucketType = StorageBucketType::Private,
        string $dir = '',
        int $expires = 7200,
        bool $autoBucket = true,
    ): array {
        if ($dir) {
            if ($autoBucket) {
                // If directory is provided, append bucket type to the directory
                $dir = sprintf('%s/%s', md5($bucketType->value), ltrim($dir, '/'));
            } else {
                // If no bucket type, just use the directory as is
                $dir = ltrim($dir, '/');
            }
        } else {
            $dir = '';
        }

        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'magic',
            'dir' => $dir,
            'expires' => $expires,
        ]);
        return $this->getFilesystem($bucketType->value)->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($organizationCode));
    }

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(string $organizationCode, array $fileNames, int $expires = 3600, StorageBucketType $bucketType = StorageBucketType::Private): array
    {
        return $this->getFilesystem($bucketType->value)->getPreSignedUrls($fileNames, $expires, $this->getOptions($organizationCode));
    }

    public function getMetas(array $paths, string $organizationCode, StorageBucketType $bucketType = StorageBucketType::Private): array
    {
        return $this->getFilesystem($bucketType->value)->getMetas($paths, $this->getOptions($organizationCode));
    }

    public function getDefaultIconPaths(string $appId = 'open'): array
    {
        $localPath = self::DEFAULT_ICON_ORGANIZATION_CODE . '/open/default';
        $defaultIconPath = BASE_PATH . '/storage/files/' . $localPath;
        $files = glob($defaultIconPath . '/*.png');
        return array_map(static function ($file) use ($localPath, $appId) {
            return str_replace([BASE_PATH . '/storage/files/', $localPath], ['', self::DEFAULT_ICON_ORGANIZATION_CODE . '/' . $appId . '/default'], $file);
        }, $files);
    }

    /**
     * Delete file from storage.
     */
    public function deleteFile(string $organizationCode, string $filePath, StorageBucketType $bucketType = StorageBucketType::Private): bool
    {
        try {
            // Validate if file path starts with organization code (security check)
            if (! Str::startsWith($filePath, $organizationCode)) {
                $this->logger->warning('File deletion failed: file path does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'file_path' => $filePath,
                ]);
                return false;
            }

            // Call cloudfile's destroy method to delete file
            $this->getFilesystem($bucketType->value)->destroy([$filePath], $this->getOptions($organizationCode));

            return true;
        } catch (Throwable $e) {
            $this->logger->error('File deletion exception', [
                'organization_code' => $organizationCode,
                'file_path' => $filePath,
                'bucket_type' => $bucketType->value,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    public function getFullPrefix(string $organizationCode): string
    {
        $md5Key = md5(StorageBucketType::Private->value);
        $appId = 'open';

        return "{$organizationCode}/{$appId}/{$md5Key}" . '/';
    }

    public function generateWorkDir(string $userId, int $projectId, string $code = 'magic', string $lastPath = 'project'): string
    {
        return sprintf('/%s/%s/%s_%d', $code, $userId, $lastPath, $projectId);
    }

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
    ): array {
        try {
            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'sts_type' => 'list_objects',
                'dir' => $prefix,  // No dir restriction for listing
                'expires' => 3600,
            ]);

            $appId = config('kk_brd_service.app_id');
            $fullPrefix = "{$organizationCode}/{$appId}" . '/' . trim($prefix, '/') . '/';
            $result = $filesystem->listObjectsByCredential($credentialPolicy, $fullPrefix, $this->getOptions($organizationCode, $options));

            $this->logger->info('list_objects_by_credential_success', [
                'organization_code' => $organizationCode,
                'prefix' => $prefix,
                'bucket_type' => $bucketType->value,
                'object_count' => count($result['objects'] ?? []),
                'is_truncated' => $result['is_truncated'] ?? false,
            ]);

            return $result;
        } catch (Throwable $exception) {
            $this->logger->error('list_objects_by_credential_failed', [
                'organization_code' => $organizationCode,
                'prefix' => $prefix,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Delete object by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to delete
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (version_id, etc.)
     * @throws Throwable
     */
    public function deleteObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        try {
            // Security check: validate if file path starts with organization code
            if (! Str::startsWith($objectKey, $organizationCode)) {
                $this->logger->warning('Object deletion failed: object key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'object_key' => $objectKey,
                ]);
                throw new InvalidArgumentException('Object key does not belong to specified organization');
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'sts_type' => 'del_objects',
                'role_session_name' => 'magic',
                'dir' => $prefix,  // No dir restriction for listing
                'expires' => 3600,
            ]);

            $filesystem->deleteObjectByCredential($credentialPolicy, $objectKey, $this->getOptions($organizationCode, $options));

            $this->logger->info('delete_object_by_credential_success', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'version_id' => $options['version_id'] ?? null,
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('delete_object_by_credential_failed', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Copy object by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $sourceKey Source object key
     * @param string $destinationKey Destination object key
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (source_bucket, source_version_id, metadata_directive, etc.)
     * @throws Throwable
     */
    public function copyObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $sourceKey,
        string $destinationKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        try {
            // Security check: validate if both keys belong to organization code or are explicitly allowed
            if (! Str::startsWith($sourceKey, $organizationCode) && ! ($options['allow_cross_organization'] ?? false)) {
                $this->logger->warning('Object copy failed: source key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'source_key' => $sourceKey,
                ]);
                throw new InvalidArgumentException('Source key does not belong to specified organization');
            }

            if (! Str::startsWith($destinationKey, $organizationCode)) {
                $this->logger->warning('Object copy failed: destination key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'destination_key' => $destinationKey,
                ]);
                throw new InvalidArgumentException('Destination key does not belong to specified organization');
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'role_session_name' => 'magic',
                'dir' => $prefix,
                'expires' => 3600,
            ]);

            $filesystem->copyObjectByCredential($credentialPolicy, $sourceKey, $destinationKey, $this->getOptions($organizationCode, $options));

            $this->logger->info('copy_object_by_credential_success', [
                'organization_code' => $organizationCode,
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket_type' => $bucketType->value,
                'source_bucket' => $options['source_bucket'] ?? null,
                'metadata_directive' => $options['metadata_directive'] ?? 'COPY',
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('copy_object_by_credential_failed', [
                'organization_code' => $organizationCode,
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Get object metadata by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to get metadata
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @return array Object metadata
     * @throws Throwable
     */
    public function getHeadObjectByCredential(
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): array {
        try {
            // Security check: validate if object key belongs to organization code
            if (! Str::startsWith($objectKey, $organizationCode)) {
                $this->logger->warning('Get object metadata failed: object key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'object_key' => $objectKey,
                ]);
                throw new InvalidArgumentException('Object key does not belong to specified organization');
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'role_session_name' => 'magic',
                'dir' => '',  // No dir restriction for head object
                'expires' => 3600,
            ]);

            $result = $filesystem->getHeadObjectByCredential($credentialPolicy, $objectKey, $this->getOptions($organizationCode, $options));

            $this->logger->info('get_head_object_by_credential_success', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'content_length' => $result['content_length'] ?? null,
                'last_modified' => $result['last_modified'] ?? null,
            ]);

            return $result;
        } catch (Throwable $exception) {
            $this->logger->error('get_head_object_by_credential_failed', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Set object metadata by credential.
     *
     * @param string $organizationCode Organization code for data isolation
     * @param string $objectKey Object key to set metadata
     * @param array $metadata Metadata to set
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @throws Throwable
     */
    public function setHeadObjectByCredential(
        string $organizationCode,
        string $objectKey,
        array $metadata,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        try {
            // Security check: validate if object key belongs to organization code
            if (! Str::startsWith($objectKey, $organizationCode)) {
                $this->logger->warning('Set object metadata failed: object key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'object_key' => $objectKey,
                ]);
                throw new InvalidArgumentException('Object key does not belong to specified organization');
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'role_session_name' => 'magic',
                'dir' => '',  // No dir restriction for setting object metadata
                'expires' => $options['expires'] ?? 3600,
            ]);

            $filesystem->setHeadObjectByCredential($credentialPolicy, $objectKey, $metadata, $this->getOptions($organizationCode, $options));

            $this->logger->info('set_head_object_by_credential_success', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'metadata_count' => count($metadata),
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('set_head_object_by_credential_failed', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'metadata_count' => count($metadata),
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Create object by credential (file or folder).
     *
     * @param string $prefix Prefix
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to create
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (content, content_type, etc.)
     * @throws Throwable
     */
    public function createObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        try {
            // Security check: validate if object key belongs to organization code
            if (! Str::startsWith($objectKey, $organizationCode)) {
                $this->logger->warning('Create object failed: object key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'object_key' => $objectKey,
                ]);
                throw new InvalidArgumentException('Object key does not belong to specified organization');
            }

            // Check if it's a folder or file
            $isFolder = str_ends_with($objectKey, '/');

            // Ensure folder names end with '/'
            if (isset($options['is_folder']) && $options['is_folder'] && ! $isFolder) {
                $objectKey .= '/';
                $isFolder = true;
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'role_session_name' => 'magic',
                'dir' => $prefix,
                'expires' => 3600,
            ]);

            // Prepare options for creation
            $createOptions = $options;

            // Set default content for folders
            if ($isFolder && ! isset($createOptions['content'])) {
                $createOptions['content'] = '';
            }

            $filesystem->createObjectByCredential($credentialPolicy, $objectKey, $this->getOptions($organizationCode, $createOptions));

            $this->logger->info('create_object_by_credential_success', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'object_type' => $isFolder ? 'folder' : 'file',
                'bucket_type' => $bucketType->value,
                'content_length' => strlen($createOptions['content'] ?? ''),
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('create_object_by_credential_failed', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Create folder by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $folderPath Folder path (will automatically add '/' if missing)
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @throws Throwable
     */
    public function createFolderByCredential(
        string $prefix,
        string $organizationCode,
        string $folderPath,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        // Ensure folder path ends with '/'
        if (! str_ends_with($folderPath, '/')) {
            $folderPath .= '/';
        }

        $options['is_folder'] = true;
        $this->createObjectByCredential($prefix, $organizationCode, $folderPath, $bucketType, $options);
    }

    /**
     * Create file by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $filePath File path
     * @param string $content File content (default empty)
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @throws Throwable
     */
    public function createFileByCredential(
        string $prefix,
        string $organizationCode,
        string $filePath,
        string $content = '',
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        // Ensure file path doesn't end with '/'
        $filePath = rtrim($filePath, '/');

        $options['content'] = $content;
        $options['is_folder'] = false;
        $this->createObjectByCredential($prefix, $organizationCode, $filePath, $bucketType, $options);
    }

    /**
     * Generate pre-signed URL by credential.
     *
     * @param string $organizationCode Organization code
     * @param string $objectKey Object key to generate URL for
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options (method, expires, filename, etc.)
     * @return string Pre-signed URL
     * @throws Throwable
     */
    public function getPreSignedUrlByCredential(
        string $organizationCode,
        string $objectKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): string {
        try {
            // Security check: validate if object key belongs to organization code
            if (! Str::startsWith($objectKey, $organizationCode)) {
                $this->logger->warning('Get pre-signed URL failed: object key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'object_key' => $objectKey,
                ]);
                throw new InvalidArgumentException('Object key does not belong to specified organization');
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'role_session_name' => 'magic',
                'dir' => '',  // No dir restriction for getting pre-signed URLs
                'expires' => $options['expires'] ?? 3600,
            ]);

            // Set default HTTP method
            if (! isset($options['method'])) {
                $options['method'] = 'GET';
            }

            $preSignedUrl = $filesystem->getPreSignedUrlByCredential($credentialPolicy, $objectKey, $this->getOptions($organizationCode, $options));

            $this->logger->info('get_presigned_url_by_credential_success', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'method' => $options['method'],
                'expires' => $options['expires'] ?? 3600,
                'url_length' => strlen($preSignedUrl),
            ]);

            return $preSignedUrl;
        } catch (Throwable $exception) {
            $this->logger->error('get_presigned_url_by_credential_failed', [
                'organization_code' => $organizationCode,
                'object_key' => $objectKey,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Delete multiple objects by credential.
     *
     * @param string $prefix Prefix for data isolation
     * @param string $organizationCode Organization code for data isolation
     * @param array $objectKeys Array of object keys to delete
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @return array Delete result with success and error information
     * @throws Throwable
     */
    public function deleteObjectsByCredential(
        string $prefix,
        string $organizationCode,
        array $objectKeys,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): array {
        try {
            // Validate input
            if (empty($objectKeys)) {
                return [
                    'deleted' => [],
                    'errors' => [],
                ];
            }

            // Security check: validate if all object keys belong to organization code
            $invalidKeys = [];
            foreach ($objectKeys as $objectKey) {
                if (! Str::startsWith($objectKey, $organizationCode)) {
                    $invalidKeys[] = $objectKey;
                }
            }

            if (! empty($invalidKeys)) {
                $this->logger->warning('Delete objects failed: some object keys do not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'invalid_keys' => $invalidKeys,
                    'total_keys' => count($objectKeys),
                ]);
                throw new InvalidArgumentException('Some object keys do not belong to specified organization');
            }

            $filesystem = $this->getFilesystem($bucketType->value);
            $credentialPolicy = new CredentialPolicy([
                'sts' => true,
                'role_session_name' => 'magic',
                'dir' => $prefix,  // No dir restriction for deleting objects
                'expires' => $options['expires'] ?? 3600,
            ]);

            $result = $filesystem->deleteObjectsByCredential($credentialPolicy, $objectKeys, $this->getOptions($organizationCode, $options));

            $this->logger->info('delete_objects_by_credential_success', [
                'organization_code' => $organizationCode,
                'bucket_type' => $bucketType->value,
                'total_requested' => count($objectKeys),
                'total_deleted' => count($result['deleted']),
                'total_errors' => count($result['errors']),
            ]);

            return $result;
        } catch (Throwable $exception) {
            $this->logger->error('delete_objects_by_credential_failed', [
                'organization_code' => $organizationCode,
                'bucket_type' => $bucketType->value,
                'total_keys' => count($objectKeys),
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    /**
     * Rename object by credential.
     *
     * @param string $prefix Prefix for the operation
     * @param string $organizationCode Organization code
     * @param string $sourceKey Source object key
     * @param string $destinationKey Destination object key
     * @param StorageBucketType $bucketType Storage bucket type
     * @param array $options Additional options
     * @throws Throwable
     */
    public function renameObjectByCredential(
        string $prefix,
        string $organizationCode,
        string $sourceKey,
        string $destinationKey,
        StorageBucketType $bucketType = StorageBucketType::Private,
        array $options = []
    ): void {
        try {
            // Security check: validate if both keys belong to organization code
            if (! Str::startsWith($sourceKey, $organizationCode)) {
                $this->logger->warning('Object rename failed: source key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'source_key' => $sourceKey,
                ]);
                throw new InvalidArgumentException('Source key does not belong to specified organization');
            }

            if (! Str::startsWith($destinationKey, $organizationCode)) {
                $this->logger->warning('Object rename failed: destination key does not belong to specified organization', [
                    'organization_code' => $organizationCode,
                    'destination_key' => $destinationKey,
                ]);
                throw new InvalidArgumentException('Destination key does not belong to specified organization');
            }

            // Extract the new filename for download
            $newFileName = basename($destinationKey);

            // Step 1: Copy object to new location with new download name
            $copyOptions = array_merge($options, [
                'metadata_directive' => 'REPLACE',
                'download_name' => $newFileName,
            ]);

            $this->copyObjectByCredential(
                $prefix,
                $organizationCode,
                $sourceKey,
                $destinationKey,
                $bucketType,
                $copyOptions
            );

            // Step 2: Verify the destination object exists before deleting source
            try {
                $destinationMetadata = $this->getHeadObjectByCredential(
                    $organizationCode,
                    $destinationKey,
                    $bucketType
                );

                $this->logger->info('rename_destination_verified', [
                    'organization_code' => $organizationCode,
                    'destination_key' => $destinationKey,
                    'content_length' => $destinationMetadata['content_length'],
                    'etag' => $destinationMetadata['etag'],
                ]);
            } catch (Throwable $verifyException) {
                $this->logger->error('rename_destination_verification_failed', [
                    'organization_code' => $organizationCode,
                    'destination_key' => $destinationKey,
                    'error' => $verifyException->getMessage(),
                ]);
                throw new RuntimeException(
                    'Destination object verification failed after copy. Rename operation aborted to prevent data loss.',
                    0,
                    $verifyException
                );
            }

            // Step 3: Delete the original object only after confirming destination exists
            $this->deleteObjectByCredential(
                $prefix, // use the same prefix as the rename operation
                $organizationCode,
                $sourceKey,
                $bucketType
            );

            $this->logger->info('rename_object_by_credential_success', [
                'organization_code' => $organizationCode,
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'new_file_name' => $newFileName,
                'bucket_type' => $bucketType->value,
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('rename_object_by_credential_failed', [
                'organization_code' => $organizationCode,
                'source_key' => $sourceKey,
                'destination_key' => $destinationKey,
                'bucket_type' => $bucketType->value,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);
            throw $exception;
        }
    }

    protected function getOptions(string $organizationCode, array $options = []): array
    {
        $defaultOptions = [
            'organization_code' => $organizationCode,
            //            'cache' => false,
        ];

        return array_merge($defaultOptions, $options);
    }

    protected function isDefaultIconPath(string $path, string $appId = 'open'): bool
    {
        $prefix = self::DEFAULT_ICON_ORGANIZATION_CODE . '/' . $appId . '/default';
        return Str::startsWith($path, $prefix);
    }

    protected function getFilesystem(string $storage): FilesystemProxy
    {
        if (! $this->cloudFile->exist($storage)) {
            $storage = StorageBucketType::Private->value;
        }
        return $this->cloudFile->get($storage);
    }
}
