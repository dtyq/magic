<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Entity;

class FileCleanupRecordEntity extends AbstractEntity
{
    public int $id;

    public string $organizationCode;

    public string $fileKey;

    public string $fileName;

    public int $fileSize;

    public string $bucketType;

    public string $sourceType;

    public ?string $sourceId;

    public string $expireAt;

    public int $status;

    public int $retryCount;

    public ?string $errorMessage;

    public ?string $createdAt;

    public ?string $updatedAt;

    public function getId(): int
    {
        return $this->id;
    }

    /**
     * 设置ID.
     */
    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    /**
     * 获取组织编码.
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * 设置组织编码.
     */
    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    /**
     * 获取文件key.
     */
    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    /**
     * 设置文件key.
     */
    public function setFileKey(string $fileKey): self
    {
        $this->fileKey = $fileKey;
        return $this;
    }

    /**
     * 获取文件名称.
     */
    public function getFileName(): string
    {
        return $this->fileName;
    }

    /**
     * 设置文件名称.
     */
    public function setFileName(string $fileName): self
    {
        $this->fileName = $fileName;
        return $this;
    }

    /**
     * 获取文件大小.
     */
    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    /**
     * 设置文件大小.
     */
    public function setFileSize(int $fileSize): self
    {
        $this->fileSize = $fileSize;
        return $this;
    }

    /**
     * 获取存储桶类型.
     */
    public function getBucketType(): string
    {
        return $this->bucketType;
    }

    /**
     * 设置存储桶类型.
     */
    public function setBucketType(string $bucketType): self
    {
        $this->bucketType = $bucketType;
        return $this;
    }

    /**
     * 获取来源类型.
     */
    public function getSourceType(): string
    {
        return $this->sourceType;
    }

    /**
     * 设置来源类型.
     */
    public function setSourceType(string $sourceType): self
    {
        $this->sourceType = $sourceType;
        return $this;
    }

    /**
     * 获取来源ID.
     */
    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }

    /**
     * 设置来源ID.
     */
    public function setSourceId(?string $sourceId): self
    {
        $this->sourceId = $sourceId;
        return $this;
    }

    /**
     * 获取过期时间.
     */
    public function getExpireAt(): string
    {
        return $this->expireAt;
    }

    /**
     * 设置过期时间.
     */
    public function setExpireAt(string $expireAt): self
    {
        $this->expireAt = $expireAt;
        return $this;
    }

    /**
     * 获取状态.
     */
    public function getStatus(): int
    {
        return $this->status;
    }

    /**
     * 设置状态.
     */
    public function setStatus(int $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 获取重试次数.
     */
    public function getRetryCount(): int
    {
        return $this->retryCount;
    }

    /**
     * 设置重试次数.
     */
    public function setRetryCount(int $retryCount): self
    {
        $this->retryCount = $retryCount;
        return $this;
    }

    /**
     * 获取错误信息.
     */
    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    /**
     * 设置错误信息.
     */
    public function setErrorMessage(?string $errorMessage): self
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    /**
     * 获取创建时间.
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    /**
     * 设置创建时间.
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    /**
     * 获取更新时间.
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    /**
     * 设置更新时间.
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    /**
     * 检查是否已过期.
     */
    public function isExpired(): bool
    {
        return strtotime($this->expireAt) <= time();
    }

    /**
     * 检查是否待清理状态.
     */
    public function isPending(): bool
    {
        return $this->status === 0;
    }

    /**
     * 检查是否已清理.
     */
    public function isCleaned(): bool
    {
        return $this->status === 1;
    }

    /**
     * 检查是否清理失败.
     */
    public function isFailed(): bool
    {
        return $this->status === 2;
    }

    /**
     * 检查是否可以重试.
     */
    public function canRetry(int $maxRetries = 3): bool
    {
        return $this->retryCount < $maxRetries;
    }
}
