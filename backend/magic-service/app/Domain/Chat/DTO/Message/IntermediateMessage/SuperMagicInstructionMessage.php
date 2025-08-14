<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\IntermediateMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\IntermediateMessageType;

class SuperMagicInstructionMessage extends AbstractIntermediateMessageStruct
{
    protected function setMessageType(): void
    {
        $this->intermediateMessageType = IntermediateMessageType::SuperMagicInstruction;
    }
}
