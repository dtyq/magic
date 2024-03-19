<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

class MagicMessageVersionEntity extends AbstractEntity
{
    protected string $versionId;

    protected string $magicMessageId;

    protected string $messageContent;

    protected ?string $messageType;

    protected string $createdAt;

    protected string $updatedAt;

    protected ?string $deletedAt;

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }

    public function getVersionId(): string
    {
        return $this->versionId;
    }

    public function setVersionId(string $versionId): static
    {
        $this->versionId = $versionId;
        return $this;
    }

    public function getMagicMessageId(): string
    {
        return $this->magicMessageId;
    }

    public function setMagicMessageId(string $magicMessageId): static
    {
        $this->magicMessageId = $magicMessageId;
        return $this;
    }

    public function getMessageContent(): string
    {
        return $this->messageContent;
    }

    public function setMessageContent(string $messageContent): static
    {
        $this->messageContent = $messageContent;
        return $this;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): static
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getMessageType(): ?string
    {
        return $this->messageType;
    }

    public function setMessageType(?string $messageType): static
    {
        $this->messageType = $messageType;
        return $this;
    }
}
