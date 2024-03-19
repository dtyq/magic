<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

use Dtyq\CloudFile\Kernel\Exceptions\ChunkUploadException;
use Dtyq\CloudFile\Kernel\Struct\AppendUploadFile;
use Dtyq\CloudFile\Kernel\Struct\ChunkUploadFile;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SdkBase\SdkBase;

abstract class SimpleUpload
{
    protected SdkBase $sdkContainer;

    public function __construct(SdkBase $sdkContainer)
    {
        $this->sdkContainer = $sdkContainer;
    }

    abstract public function uploadObject(array $credential, UploadFile $uploadFile): void;

    abstract public function appendUploadObject(array $credential, AppendUploadFile $appendUploadFile): void;

    /**
     * List objects by credential.
     *
     * @param array $credential Credential information
     * @param string $prefix Object prefix to filter
     * @param array $options Additional options (marker, max-keys, etc.)
     * @return array List of objects
     */
    abstract public function listObjectsByCredential(array $credential, string $prefix = '', array $options = []): array;

    /**
     * Delete object by credential.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to delete
     * @param array $options Additional options
     */
    abstract public function deleteObjectByCredential(array $credential, string $objectKey, array $options = []): void;

    /**
     * Copy object by credential.
     *
     * @param array $credential Credential information
     * @param string $sourceKey Source object key
     * @param string $destinationKey Destination object key
     * @param array $options Additional options
     */
    abstract public function copyObjectByCredential(array $credential, string $sourceKey, string $destinationKey, array $options = []): void;

    /**
     * Get object metadata by credential.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to get metadata
     * @param array $options Additional options
     * @return array Object metadata
     */
    abstract public function getHeadObjectByCredential(array $credential, string $objectKey, array $options = []): array;

    /**
     * Create object by credential (file or folder).
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to create
     * @param array $options Additional options (content, content_type, etc.)
     */
    abstract public function createObjectByCredential(array $credential, string $objectKey, array $options = []): void;

    /**
     * Generate pre-signed URL by credential.
     *
     * @param array $credential Credential information
     * @param string $objectKey Object key to generate URL for
     * @param array $options Additional options (method, expires, filename, etc.)
     * @return string Pre-signed URL
     */
    abstract public function getPreSignedUrlByCredential(array $credential, string $objectKey, array $options = []): string;

    /**
     * Delete multiple objects by credential.
     *
     * @param array $credential Credential array
     * @param array $objectKeys Array of object keys to delete
     * @param array $options Additional options
     * @return array Delete result with success and error information
     */
    abstract public function deleteObjectsByCredential(array $credential, array $objectKeys, array $options = []): array;

    /**
     * Set object metadata by credential.
     *
     * @param array $credential Credential array
     * @param string $objectKey Object key to set metadata
     * @param array $metadata Metadata to set
     * @param array $options Additional options
     */
    abstract public function setHeadObjectByCredential(array $credential, string $objectKey, array $metadata, array $options = []): void;

    /**
     * 分片上传文件
     * 默认实现抛出"暂未实现"异常，子类需要重写此方法.
     *
     * @param array $credential 凭证信息
     * @param ChunkUploadFile $chunkUploadFile 分片上传文件对象
     * @throws ChunkUploadException
     */
    public function uploadObjectByChunks(array $credential, ChunkUploadFile $chunkUploadFile): void
    {
        throw ChunkUploadException::createInitFailed(
            'Chunk upload not implemented for ' . static::class
        );
    }
}
