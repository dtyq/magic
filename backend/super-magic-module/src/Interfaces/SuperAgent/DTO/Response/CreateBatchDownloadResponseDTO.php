<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class CreateBatchDownloadResponseDTO
{
    /**
     * @var string 处理状态 (ready|processing)
     */
    protected string $status;

    /**
     * @var string 批次Key
     */
    protected string $batchKey;

    /**
     * @var null|string 下载URL（状态为ready时提供）
     */
    protected ?string $downloadUrl;

    /**
     * @var int 文件数量
     */
    protected int $fileCount;

    /**
     * @var string 描述信息
     */
    protected string $message;

    /**
     * 构造函数.
     */
    public function __construct(
        string $status,
        string $batchKey,
        ?string $downloadUrl = null,
        int $fileCount = 0,
        string $message = ''
    ) {
        $this->status = $status;
        $this->batchKey = $batchKey;
        $this->downloadUrl = $downloadUrl;
        $this->fileCount = $fileCount;
        $this->message = $message;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'batch_key' => $this->batchKey,
            'download_url' => $this->downloadUrl,
            'file_count' => $this->fileCount,
            'message' => $this->message,
        ];
    }

    /**
     * 获取处理状态.
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * 获取批次Key.
     */
    public function getBatchKey(): string
    {
        return $this->batchKey;
    }

    /**
     * 获取下载URL.
     */
    public function getDownloadUrl(): ?string
    {
        return $this->downloadUrl;
    }

    /**
     * 获取文件数量.
     */
    public function getFileCount(): int
    {
        return $this->fileCount;
    }

    /**
     * 获取描述信息.
     */
    public function getMessage(): string
    {
        return $this->message;
    }
}
