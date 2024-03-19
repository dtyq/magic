<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class GroupDisbandMessage extends AbstractControlMessageStruct
{
    protected ?string $operateUserId = null;

    protected ?string $groupId = null;

    protected ?string $conversationId = null;

    protected array $userIds = [];

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

    public function getUserIds(): array
    {
        return $this->userIds;
    }

    public function setUserIds(array $userIds): void
    {
        $this->userIds = $userIds;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::GroupDisband;
    }
}
