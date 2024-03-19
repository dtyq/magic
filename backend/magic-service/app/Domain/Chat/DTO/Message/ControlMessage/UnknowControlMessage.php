<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class UnknowControlMessage extends TopicCreateMessage
{
    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::Unknown;
    }
}
