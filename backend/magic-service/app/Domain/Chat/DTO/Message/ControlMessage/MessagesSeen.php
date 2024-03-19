<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class MessagesSeen extends AbstractControlMessageStruct
{
    protected array $referMessageIds = [];

    public function getReferMessageIds(): array
    {
        return $this->referMessageIds;
    }

    public function setReferMessageIds(array $referMessageIds): void
    {
        $this->referMessageIds = $referMessageIds;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::SeenMessages;
    }
}
