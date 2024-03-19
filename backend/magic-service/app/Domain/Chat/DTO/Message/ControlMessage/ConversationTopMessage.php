<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class ConversationTopMessage extends AbstractConversationOptionChangeMessage
{
    protected int $isTop;

    public function getIsTop(): int
    {
        return $this->isTop;
    }

    public function setIsTop(int $isTop): void
    {
        $this->isTop = $isTop;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::TopConversation;
    }
}
