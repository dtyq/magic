<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class CheckBatchDownloadResponseDTO
{
    /**
     * @var string 处理状态 (ready|processing|failed)
     */
    protected string $status;

    /**
     * @var null|string 下载URL（状态为ready时提供）
     */
    protected ?string $downloadUrl;

    /**
     * @var null|int 处理进度（0-100）
     */
    protected ?int $progress;

    /**
     * @var string 描述信息
     */
    protected string $message;

    /**
     * 构造函数.
     */
    public function __construct(
        string $status,
        ?string $downloadUrl = null,
        ?int $progress = null,
        string $message = ''
    ) {
        $this->status = $status;
        $this->downloadUrl = $downloadUrl;
        $this->progress = $progress;
        $this->message = $message;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'download_url' => $this->downloadUrl,
            'progress' => $this->progress,
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
     * 获取下载URL.
     */
    public function getDownloadUrl(): ?string
    {
        return $this->downloadUrl;
    }

    /**
     * 获取处理进度.
     */
    public function getProgress(): ?int
    {
        return $this->progress;
    }

    /**
     * 获取描述信息.
     */
    public function getMessage(): string
    {
        return $this->message;
    }
}
