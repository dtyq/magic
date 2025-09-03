<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

use App\Domain\Chat\Entity\ValueObject\FileType;

final class MagicChatFileEntity extends AbstractEntity
{
    protected ?string $fileId = null;

    protected ?string $userId = null;

    protected ?string $magicMessageId = null;

    protected ?string $organizationCode = null;

    protected ?string $fileExtension = null;

    protected ?string $fileKey = null;

    protected ?int $fileSize = null;

    protected ?string $fileName = null;

    protected ?FileType $fileType = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    // 外链
    protected ?string $externalUrl = '';

    /**
     * 数据表中没有这个字段，但是为了 dto 复用，这里用 private 添加 message_id 字段.
     */
    private ?string $messageId = null;

    public function getMessageId(): ?string
    {
        return $this->messageId;
    }

    public function setMessageId(?string $messageId): void
    {
        // 数据表中没有这个字段，但是为了 dto 复用，这里用 private 添加 message_id 字段.
        if (! empty($messageId)) {
            $this->messageId = $messageId;
            return;
        }
        $this->messageId = $messageId;
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function setFileName(?string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function getFileType(): ?FileType
    {
        return $this->fileType;
    }

    public function setFileType(null|FileType|int $fileType): void
    {
        if (is_int($fileType)) {
            $fileType = FileType::tryFrom($fileType);
        }
        $this->fileType = $fileType;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId;
    }

    public function getMagicMessageId(): ?string
    {
        return $this->magicMessageId;
    }

    public function setMagicMessageId(?string $magicMessageId): void
    {
        $this->magicMessageId = $magicMessageId;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getFileExtension(): ?string
    {
        return $this->fileExtension;
    }

    public function setFileExtension(?string $fileExtension): void
    {
        $this->fileExtension = $fileExtension;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function setFileKey(?string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    public function getFileSize(): ?int
    {
        return $this->fileSize;
    }

    public function setFileSize(?int $fileSize): void
    {
        $this->fileSize = $fileSize;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getFileId(): ?string
    {
        return $this->fileId;
    }

    public function setFileId(null|int|string $fileId): void
    {
        if (is_int($fileId)) {
            $fileId = (string) $fileId;
        }
        $this->fileId = $fileId;
    }

    public function setExternalUrl(?string $externalUrl): void
    {
        $this->externalUrl = $externalUrl;
    }

    public function getExternalUrl(): ?string
    {
        return $this->externalUrl;
    }
}
