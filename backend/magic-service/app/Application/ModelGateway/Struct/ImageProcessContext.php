<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Struct;

use App\Infrastructure\ExternalAPI\Image\ImageAsset;

/**
 * 图片处理管线中的运行时上下文。
 * 它同时保存当前图片资产、处理配置以及处理后的中间/最终结果。
 */
final class ImageProcessContext
{
    private string $organizationCode = '';

    private ?ImagePostProcessOptions $postProcessOptions = null;

    private string $storageSubDir = 'open/image-operation';

    private string $uploadFileNamePrefix = 'image_operation';

    private string $uploadedUrl = '';

    private string $uploadedMimeType = '';

    public function __construct(
        private ImageAsset $asset,
        private string $localFilePath = '',
    ) {
        // 本地文件资产默认直接复用其路径，避免后续处理器重复判断。
        if ($this->localFilePath === '' && $this->asset->isLocalFile()) {
            $this->localFilePath = $this->asset->getValue();
        }
    }

    public function getAsset(): ImageAsset
    {
        return $this->asset;
    }

    public function setAsset(ImageAsset $asset): void
    {
        $this->asset = $asset;
    }

    public function getLocalFilePath(): string
    {
        return $this->localFilePath;
    }

    public function setLocalFilePath(string $localFilePath): void
    {
        $this->localFilePath = $localFilePath;
    }

    public function getMimeType(): string
    {
        return $this->asset->getMimeType();
    }

    public function getProvider(): ?string
    {
        return $this->asset->getProvider();
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getPostProcessOptions(): ?ImagePostProcessOptions
    {
        return $this->postProcessOptions;
    }

    public function setPostProcessOptions(?ImagePostProcessOptions $postProcessOptions): void
    {
        $this->postProcessOptions = $postProcessOptions;
    }

    public function getStorageSubDir(): string
    {
        return $this->storageSubDir;
    }

    public function setStorageSubDir(string $storageSubDir): void
    {
        $this->storageSubDir = $storageSubDir;
    }

    public function getUploadFileNamePrefix(): string
    {
        return $this->uploadFileNamePrefix;
    }

    public function setUploadFileNamePrefix(string $uploadFileNamePrefix): void
    {
        $this->uploadFileNamePrefix = $uploadFileNamePrefix;
    }

    public function getUploadedUrl(): string
    {
        return $this->uploadedUrl;
    }

    public function setUploadedUrl(string $uploadedUrl): void
    {
        $this->uploadedUrl = $uploadedUrl;
    }

    public function getUploadedMimeType(): string
    {
        return $this->uploadedMimeType;
    }

    public function setUploadedMimeType(string $uploadedMimeType): void
    {
        $this->uploadedMimeType = $uploadedMimeType;
    }
}
