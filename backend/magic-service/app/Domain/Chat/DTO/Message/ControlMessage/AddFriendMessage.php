<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class AddFriendMessage extends AbstractControlMessageStruct
{
    protected string $userId;

    protected ?string $receiveId = null;

    protected ?int $receiveType = null;

    public function __construct(?array $messageStruct = null)
    {
        parent::__construct($messageStruct);
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getReceiveId(): ?string
    {
        return $this->receiveId;
    }

    public function setReceiveId(?string $receiveId): AddFriendMessage
    {
        $this->receiveId = $receiveId;
        return $this;
    }

    public function getReceiveType(): ?int
    {
        return $this->receiveType;
    }

    public function setReceiveType(?int $receiveType): AddFriendMessage
    {
        $this->receiveType = $receiveType;
        return $this;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::AddFriendSuccess;
    }
}
