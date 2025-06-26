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
use Dtyq\CloudFile\Kernel\Struct\ChunkDownloadConfig;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\CredentialPolicy;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Stringable\Str;
use Psr\Log\LoggerInterface;
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
            $defaultIconLinks = $this->cloudFile->get(StorageBucketType::Public->value)->getLinks($defaultIconPaths, [], $expires, $this->getOptions(self::DEFAULT_ICON_ORGANIZATION_CODE, $options));
            $links = array_merge($links, $defaultIconLinks);
        }
        if (empty($paths)) {
            return $links;
        }
        try {
            $otherLinks = $this->cloudFile->get($bucketType->value)->getLinks($paths, $downloadNames, $expires, $this->getOptions($organizationCode, $options));
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
        $filesystem = $this->cloudFile->get($storage->value);
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
        $filesystem = $this->cloudFile->get($storage->value);
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
        $filesystem = $this->cloudFile->get($bucketType->value);

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
        $filesystem = $this->cloudFile->get($storage->value);
        $filesystem->upload($uploadFile, $this->getOptions($organizationCode));
    }

    public function getSimpleUploadTemporaryCredential(string $organizationCode, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null, bool $sts = false): array
    {
        $filesystem = $this->cloudFile->get($storage->value);
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
        int $expires = 7200
    ): array {
        $dir = $dir ? sprintf('%s/%s', md5($bucketType->value), ltrim($dir, '/')) : md5($bucketType->value);
        $credentialPolicy = new CredentialPolicy([
            'sts' => true,
            'role_session_name' => 'magic',
            'dir' => $dir,
            'expires' => $expires,
        ]);
        return $this->cloudFile->get($bucketType->value)->getUploadTemporaryCredential($credentialPolicy, $this->getOptions($organizationCode));
    }

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(string $organizationCode, array $fileNames, int $expires = 3600, StorageBucketType $bucketType = StorageBucketType::Private): array
    {
        return $this->cloudFile->get($bucketType->value)->getPreSignedUrls($fileNames, $expires, $this->getOptions($organizationCode));
    }

    public function getMetas(array $paths, string $organizationCode): array
    {
        return $this->cloudFile->get(StorageBucketType::Private->value)->getMetas($paths, $this->getOptions($organizationCode));
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
            $this->cloudFile->get($bucketType->value)->destroy([$filePath], $this->getOptions($organizationCode));

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
}
