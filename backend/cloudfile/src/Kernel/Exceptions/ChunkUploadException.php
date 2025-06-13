<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Exceptions;

use Throwable;

/**
 * 分片上传异常类.
 */
class ChunkUploadException extends CloudFileException
{
    /**
     * 上传ID.
     */
    private string $uploadId = '';

    /**
     * 分片号.
     */
    private int $partNumber = 0;

    public function __construct(string $message = '', int $code = 0, ?Throwable $previous = null, string $uploadId = '', int $partNumber = 0)
    {
        parent::__construct($message, $code, $previous);
        $this->uploadId = $uploadId;
        $this->partNumber = $partNumber;
    }

    public function getUploadId(): string
    {
        return $this->uploadId;
    }

    public function getPartNumber(): int
    {
        return $this->partNumber;
    }

    /**
     * 创建初始化分片上传失败异常.
     */
    public static function createInitFailed(string $message, string $uploadId = '', ?Throwable $previous = null): self
    {
        return new self("Init multipart upload failed: {$message}", 1001, $previous, $uploadId);
    }

    /**
     * 创建分片上传失败异常.
     */
    public static function createPartUploadFailed(string $message, string $uploadId, int $partNumber, ?Throwable $previous = null): self
    {
        return new self("Upload part {$partNumber} failed: {$message}", 1002, $previous, $uploadId, $partNumber);
    }

    /**
     * 创建完成分片上传失败异常.
     */
    public static function createCompleteFailed(string $message, string $uploadId, ?Throwable $previous = null): self
    {
        return new self("Complete multipart upload failed: {$message}", 1003, $previous, $uploadId);
    }

    /**
     * 创建取消分片上传失败异常.
     */
    public static function createAbortFailed(string $message, string $uploadId, ?Throwable $previous = null): self
    {
        return new self("Abort multipart upload failed: {$message}", 1004, $previous, $uploadId);
    }

    /**
     * 创建分片大小不符合要求异常.
     */
    public static function createInvalidChunkSize(int $chunkSize): self
    {
        return new self("Invalid chunk size: {$chunkSize}. Must be between 5MB and 5GB", 1005);
    }

    /**
     * 创建分片数量超限异常.
     */
    public static function createTooManyChunks(int $chunkCount): self
    {
        return new self("Too many chunks: {$chunkCount}. Maximum allowed is 10000", 1006);
    }

    /**
     * 创建重试次数耗尽异常.
     */
    public static function createRetryExhausted(string $uploadId, int $partNumber, int $maxRetries): self
    {
        return new self("Retry exhausted for part {$partNumber} after {$maxRetries} attempts", 1007, null, $uploadId, $partNumber);
    }

    /**
     * 创建超时异常.
     */
    public static function createTimeout(string $uploadId, int $partNumber = 0): self
    {
        $message = $partNumber > 0 ? "Upload part {$partNumber} timeout" : 'Upload timeout';
        return new self($message, 1008, null, $uploadId, $partNumber);
    }
}
