<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class ConversationWindowCreateMessage extends AbstractControlMessageStruct
{
    protected ?string $id = null;

    protected ?string $receiveId = null;

    protected ?int $receiveType = null;

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(?string $id): void
    {
        $this->id = $id;
    }

    public function getReceiveId(): ?string
    {
        return $this->receiveId;
    }

    public function setReceiveId(?string $receiveId): void
    {
        $this->receiveId = $receiveId;
    }

    public function getReceiveType(): ?int
    {
        return $this->receiveType;
    }

    public function setReceiveType(?int $receiveType): void
    {
        $this->receiveType = $receiveType;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::CreateConversation;
    }
}
