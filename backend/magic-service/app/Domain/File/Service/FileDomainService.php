<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Service;

use App\Domain\File\Repository\Persistence\CloudFileRepository;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\CloudFile\Kernel\Struct\FilePreSignedUrl;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;

readonly class FileDomainService
{
    public function __construct(
        private CloudFileRepositoryInterface $cloudFileRepository
    ) {
    }

    public function getDefaultIcons(): array
    {
        $paths = $this->cloudFileRepository->getDefaultIconPaths();
        $links = $this->cloudFileRepository->getLinks(CloudFileRepository::DEFAULT_ICON_ORGANIZATION_CODE, array_values($paths), StorageBucketType::Public);
        $list = [];
        foreach ($links as $link) {
            // 获取文件名称，不带后缀
            $fileName = pathinfo($link->getPath(), PATHINFO_FILENAME);
            $list[$fileName] = $link->getUrl();
        }
        return $list;
    }

    public function getLink(string $organizationCode, string $filePath, ?StorageBucketType $bucketType = null, array $downloadNames = []): ?FileLink
    {
        return $this->cloudFileRepository->getLinks($organizationCode, [$filePath], $bucketType, $downloadNames)[$filePath] ?? null;
    }

    public function uploadByCredential(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private, bool $autoDir = true, ?string $contentType = null): void
    {
        $this->cloudFileRepository->uploadByCredential($organizationCode, $uploadFile, $storage, $autoDir, $contentType);
    }

    public function upload(string $organizationCode, UploadFile $uploadFile, StorageBucketType $storage = StorageBucketType::Private): void
    {
        $this->cloudFileRepository->upload($organizationCode, $uploadFile, $storage);
    }

    public function getSimpleUploadTemporaryCredential(string $organizationCode, StorageBucketType $storage = StorageBucketType::Private, ?string $contentType = null): array
    {
        return $this->cloudFileRepository->getSimpleUploadTemporaryCredential($organizationCode, $storage, contentType: $contentType);
    }

    /**
     * @return array<string, FilePreSignedUrl>
     */
    public function getPreSignedUrls(string $organizationCode, array $fileNames, int $expires = 3600, StorageBucketType $bucketType = StorageBucketType::Private): array
    {
        return $this->cloudFileRepository->getPreSignedUrls($organizationCode, $fileNames, $expires, $bucketType);
    }

    /**
     * @return array<string,FileLink>
     */
    public function getLinks(string $organizationCode, array $filePaths, ?StorageBucketType $bucketType = null, array $downloadNames = [], array $options = []): array
    {
        return $this->cloudFileRepository->getLinks($organizationCode, $filePaths, $bucketType, $downloadNames);
    }

    public function getMetas(array $paths, string $organizationCode): array
    {
        return $this->cloudFileRepository->getMetas($paths, $organizationCode);
    }

    /**
     * 开启 sts 模式.
     * 获取临时凭证给前端使用.
     * @todo 安全问题，dir 没有校验，没有组织隔离
     */
    public function getStsTemporaryCredential(
        string $organizationCode,
        StorageBucketType $bucketType = StorageBucketType::Private,
        string $dir = '',
        int $expires = 7200
    ) {
        return $this->cloudFileRepository->getStsTemporaryCredential($organizationCode, $bucketType, $dir, $expires);
    }

    public function exist(array $metas, string $key): bool
    {
        foreach ($metas as $meta) {
            if ($meta->getPath() === $key) {
                return true;
            }
        }
        return false;
    }
}
