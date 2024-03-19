<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class InstructMessage extends AbstractControlMessageStruct
{
    private array $instruct;

    public function getInstruct(): array
    {
        return $this->instruct;
    }

    public function setInstruct(array $instruct): void
    {
        $this->instruct = $instruct;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::AgentInstruct;
    }
}
