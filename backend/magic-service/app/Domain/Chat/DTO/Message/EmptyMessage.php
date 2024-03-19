<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class EmptyMessage implements MessageInterface
{
    public function toArray(bool $filterNull = false): array
    {
        return [];
    }

    public function getMessageTypeEnum(): ChatMessageType|ControlMessageType
    {
        return ChatMessageType::Text;
    }
}
