<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class ConversationMuteMessage extends AbstractConversationOptionChangeMessage
{
    protected int $isNotDisturb;

    public function getIsNotDisturb(): int
    {
        return $this->isNotDisturb;
    }

    public function setIsNotDisturb(int $isNotDisturb): void
    {
        $this->isNotDisturb = $isNotDisturb;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::MuteConversation;
    }
}
