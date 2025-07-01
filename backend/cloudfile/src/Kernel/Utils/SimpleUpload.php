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
