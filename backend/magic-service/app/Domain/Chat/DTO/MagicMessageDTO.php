<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO;

use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\IntermediateMessageType;
use App\Infrastructure\Core\AbstractDTO;

class MagicMessageDTO extends AbstractDTO
{
    protected ?string $senderId;

    protected ?ConversationType $senderType;

    protected ?string $senderOrganizationCode;

    protected ?string $receiveId;

    protected ?ConversationType $receiveType;

    protected ?string $receiveOrganizationCode;

    protected ?string $appMessageId;

    protected ?MessageInterface $content;

    protected null|ChatMessageType|ControlMessageType|IntermediateMessageType $messageType;

    protected ?string $sendTime;

    protected ?string $createdAt;

    protected ?string $updatedAt;

    protected ?string $deletedAt;

    protected ?string $topicId;

    public function getSenderId(): ?string
    {
        return $this->senderId ?? null;
    }

    public function setSenderId(?string $senderId): static
    {
        $this->senderId = $senderId;
        return $this;
    }

    public function getSenderType(): ?ConversationType
    {
        return $this->senderType ?? null;
    }

    public function setSenderType(?ConversationType $senderType): static
    {
        $this->senderType = $senderType;
        return $this;
    }

    public function getSenderOrganizationCode(): ?string
    {
        return $this->senderOrganizationCode ?? null;
    }

    public function setSenderOrganizationCode(?string $senderOrganizationCode): static
    {
        $this->senderOrganizationCode = $senderOrganizationCode;
        return $this;
    }

    public function getReceiveId(): ?string
    {
        return $this->receiveId ?? null;
    }

    public function setReceiveId(?string $receiveId): static
    {
        $this->receiveId = $receiveId;
        return $this;
    }

    public function getReceiveType(): ?ConversationType
    {
        return $this->receiveType ?? null;
    }

    public function setReceiveType(?ConversationType $receiveType): static
    {
        $this->receiveType = $receiveType;
        return $this;
    }

    public function getReceiveOrganizationCode(): ?string
    {
        return $this->receiveOrganizationCode ?? null;
    }

    public function setReceiveOrganizationCode(?string $receiveOrganizationCode): static
    {
        $this->receiveOrganizationCode = $receiveOrganizationCode;
        return $this;
    }

    public function getAppMessageId(): ?string
    {
        return $this->appMessageId ?? null;
    }

    public function setAppMessageId(?string $appMessageId): static
    {
        $this->appMessageId = $appMessageId;
        return $this;
    }

    public function getContent(): ?MessageInterface
    {
        return $this->content ?? null;
    }

    public function setContent(?MessageInterface $content): static
    {
        $this->content = $content;
        return $this;
    }

    public function getMessageType(): null|ChatMessageType|ControlMessageType|IntermediateMessageType
    {
        return $this->messageType ?? null;
    }

    public function setMessageType(null|ChatMessageType|ControlMessageType|IntermediateMessageType $messageType): static
    {
        $this->messageType = $messageType;
        return $this;
    }

    public function getSendTime(): ?string
    {
        return $this->sendTime ?? null;
    }

    public function setSendTime(?string $sendTime): static
    {
        $this->sendTime = $sendTime;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt ?? null;
    }

    public function setCreatedAt(?string $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt ?? null;
    }

    public function setUpdatedAt(?string $updatedAt): static
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt ?? null;
    }

    public function setDeletedAt(?string $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId ?? null;
    }

    public function setTopicId(?string $topicId): static
    {
        $this->topicId = $topicId;
        return $this;
    }
}
