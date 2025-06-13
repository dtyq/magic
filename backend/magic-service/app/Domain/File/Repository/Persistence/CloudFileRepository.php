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

    private CloudFile $cloudFile;

    private LoggerInterface $logger;

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
    public function getLinks(string $organizationCode, array $filePaths, ?StorageBucketType $bucketType = null, array $downloadNames = []): array
    {
        $filePaths = array_filter($filePaths);

        if ($bucketType === null) {
            // 如果没有存储桶，进行一次自动归类
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
                    // 兜底私有桶
                    $privateFilePaths[] = $filePath;
                }
            }
            return array_merge(
                $this->getLinks($organizationCode, $privateFilePaths, StorageBucketType::Private, $downloadNames),
                $this->getLinks($organizationCode, $publicFilePaths, StorageBucketType::Public, $downloadNames)
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
            // 如果不是组织开头的文件，忽略
            if (! Str::startsWith($filePath, $organizationCode)) {
                continue;
            }
            $paths[] = $filePath;
        }
        // 临时提高下载链接有效期
        $expires = 60 * 60 * 24;
        if (! empty($defaultIconPaths)) {
            $defaultIconLinks = $this->cloudFile->get(StorageBucketType::Public->value)->getLinks($defaultIconPaths, [], $expires, $this->getOptions(self::DEFAULT_ICON_ORGANIZATION_CODE));
            $links = array_merge($links, $defaultIconLinks);
        }
        if (empty($paths)) {
            return $links;
        }
        try {
            $otherLinks = $this->cloudFile->get($bucketType->value)->getLinks($paths, $downloadNames, $expires, $this->getOptions($organizationCode));
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
            // 采用在文件路径中增加配置名的形式后续获取链接时自动识别
            'dir' => $autoDir ? $organizationCode . '/open/' . md5($storage->value) : '',
            'content_type' => $contentType,
        ]);
        $filesystem->uploadByCredential($uploadFile, $credentialPolicy, $this->getOptions($organizationCode));
    }

    public function upload(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true): void
    {
        $filesystem = $this->cloudFile->get($storage->value);
        $filesystem->upload($uploadFile, $this->getOptions($organizationCode));
    }

    public function getSimpleUploadTemporaryCredential(string $organizationCode, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null): array
    {
        $filesystem = $this->cloudFile->get($storage->value);
        $credentialPolicy = new CredentialPolicy([
            'sts' => false,
            'role_session_name' => 'magic',
            // 采用在文件路径中增加配置名的形式后续获取链接时自动识别
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

    protected function getOptions(string $organizationCode): array
    {
        return [
            'organization_code' => $organizationCode,
            //            'cache' => false,
        ];
    }

    protected function isDefaultIconPath(string $path, string $appId = 'open'): bool
    {
        $prefix = self::DEFAULT_ICON_ORGANIZATION_CODE . '/' . $appId . '/default';
        return Str::startsWith($path, $prefix);
    }
}
