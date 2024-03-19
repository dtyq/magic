<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class GroupUserRoleChangeMessage extends GroupUserAddMessage
{
    protected ?int $role = null;

    public function getRole(): ?int
    {
        return $this->role;
    }

    public function setRole(?int $role): void
    {
        $this->role = $role;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::GroupUserRoleChange;
    }
}
