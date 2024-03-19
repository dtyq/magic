<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Entity;

class DefaultFileEntity extends AbstractEntity
{
    public int $id;

    public string $businessType;

    public int $fileType;

    public string $key;

    public int $fileSize;

    public string $organization;

    public string $fileExtension;

    public string $userId;

    public ?string $createdAt;

    public ?string $updatedAt;

    public ?string $deletedAt;

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
     * 设置业务类型.
     */
    public function setBusinessType(string $businessType): self
    {
        $this->businessType = $businessType;
        return $this;
    }

    /**
     * 获取文件类型.
     */
    public function getFileType(): int
    {
        return $this->fileType;
    }

    /**
     * 设置文件类型.
     */
    public function setFileType(int $fileType): self
    {
        $this->fileType = $fileType;
        return $this;
    }

    /**
     * 获取文件key.
     */
    public function getKey(): string
    {
        return $this->key;
    }

    /**
     * 设置文件key.
     */
    public function setKey(string $key): self
    {
        $this->key = $key;
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
     * 获取组织编码
     */
    public function getOrganization(): string
    {
        return $this->organization;
    }

    /**
     * 设置组织编码
     */
    public function setOrganization(string $organization): self
    {
        $this->organization = $organization;
        return $this;
    }

    /**
     * 获取文件后缀
     */
    public function getFileExtension(): string
    {
        return $this->fileExtension;
    }

    /**
     * 设置文件后缀
     */
    public function setFileExtension(string $fileExtension): self
    {
        $this->fileExtension = $fileExtension;
        return $this;
    }

    /**
     * 获取上传者ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * 设置上传者ID.
     */
    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
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
     * 获取删除时间.
     */
    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    /**
     * 设置删除时间.
     */
    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }
}
