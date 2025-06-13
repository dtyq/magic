<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils\SimpleUpload;

use Dtyq\CloudFile\Kernel\AdapterName;
use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\CloudFile\Kernel\Utils\SimpleUpload;

class FileServiceSimpleUpload extends SimpleUpload
{
    protected array $simpleUploadsMap = [
        AdapterName::ALIYUN => AliyunSimpleUpload::class,
        AdapterName::TOS => TosSimpleUpload::class,
        AdapterName::OBS => ObsSimpleUpload::class,
    ];

    /**
     * @var array<string, SimpleUpload>
     */
    protected array $simpleUploadInstances = [];

    public function uploadObject(array $credential, UploadFile $uploadFile): void
    {
        $platform = $credential['platform'] ?? '';
        $credential = $credential['temporary_credential'] ?? [];
        if (empty($platform) || empty($credential)) {
            throw new CloudFileException('credential is empty');
        }

        if (! isset($this->simpleUploadsMap[$platform])) {
            throw new CloudFileException('platform is invalid');
        }

        if (! isset($this->simpleUploadInstances[$platform])) {
            $this->simpleUploadInstances[$platform] = new $this->simpleUploadsMap[$platform]($this->sdkContainer);
        }
        $simpleUpload = $this->simpleUploadInstances[$platform];
        $simpleUpload->uploadObject($credential, $uploadFile);
    }

    public function appendUploadObject(array $credential, AppendUploadFile $appendUploadFile): void
    {
        $platform = $credential['platform'] ?? '';
        $credential = $credential['temporary_credential'] ?? [];
        if (empty($platform) || empty($credential)) {
            throw new CloudFileException('credential is empty');
        }

        if (! isset($this->simpleUploadsMap[$platform])) {
            throw new CloudFileException('platform is invalid');
        }

        if (! isset($this->simpleUploadInstances[$platform])) {
            $this->simpleUploadInstances[$platform] = new $this->simpleUploadsMap[$platform]($this->sdkContainer);
        }

        $simpleUpload = $this->simpleUploadInstances[$platform];
        $simpleUpload->appendUploadObject($credential, $appendUploadFile);
    }

    /**
     * 分片上传文件
     * 将请求转发给具体的平台实现.
     *
     * @param array $credential 凭证信息
     * @param ChunkUploadFile $chunkUploadFile 分片上传文件对象
     * @throws CloudFileException
     */
    public function uploadObjectByChunks(array $credential, ChunkUploadFile $chunkUploadFile): void
    {
        $platform = $credential['platform'] ?? '';
        $platformCredential = $credential['temporary_credential'] ?? [];
        if (empty($platform) || empty($platformCredential)) {
            throw new CloudFileException('credential is empty');
        }

        if (! isset($this->simpleUploadsMap[$platform])) {
            throw new CloudFileException('platform is invalid');
        }

        if (! isset($this->simpleUploadInstances[$platform])) {
            $this->simpleUploadInstances[$platform] = new $this->simpleUploadsMap[$platform]($this->sdkContainer);
        }

        $simpleUpload = $this->simpleUploadInstances[$platform];
        $simpleUpload->uploadObjectByChunks($credential, $chunkUploadFile);
    }
}
