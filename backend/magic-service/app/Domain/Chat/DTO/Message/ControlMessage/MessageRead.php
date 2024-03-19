<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class MessageRead extends AbstractControlMessageStruct
{
    protected ?string $referMessageId = null;

    public function getReferMessageId(): ?string
    {
        return $this->referMessageId;
    }

    public function setReferMessageId(?string $referMessageId): void
    {
        $this->referMessageId = $referMessageId;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::ReadMessage;
    }
}
