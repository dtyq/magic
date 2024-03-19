<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class GroupOwnerChangeMessage extends AbstractControlMessageStruct
{
    protected ?string $operateUserId = null;

    protected ?string $groupId = null;

    protected ?string $conversationId = null;

    protected ?string $oldOwnerUserId = null;

    protected ?string $newOwnerUserId = null;

    public function getOperateUserId(): ?string
    {
        return $this->operateUserId;
    }

    public function setOperateUserId(?string $operateUserId): void
    {
        $this->operateUserId = $operateUserId;
    }

    public function getGroupId(): ?string
    {
        return $this->groupId;
    }

    public function setGroupId(?string $groupId): void
    {
        $this->groupId = $groupId;
    }

    public function getConversationId(): ?string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getOldOwnerUserId(): ?string
    {
        return $this->oldOwnerUserId;
    }

    public function setOldOwnerUserId(?string $oldOwnerUserId): void
    {
        $this->oldOwnerUserId = $oldOwnerUserId;
    }

    public function getNewOwnerUserId(): ?string
    {
        return $this->newOwnerUserId;
    }

    public function setNewOwnerUserId(?string $newOwnerUserId): void
    {
        $this->newOwnerUserId = $newOwnerUserId;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::GroupUserRoleChange;
    }
}
