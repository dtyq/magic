<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class GroupCreateMessage extends AbstractControlMessageStruct
{
    protected ?string $operateUserId = null;

    protected ?string $groupId = null;

    protected ?string $groupName = null;

    protected ?string $groupAvatar = null;

    protected ?string $groupOwnerId = null;

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

    public function getGroupName(): ?string
    {
        return $this->groupName;
    }

    public function setGroupName(?string $groupName): void
    {
        $this->groupName = $groupName;
    }

    public function getGroupAvatar(): ?string
    {
        return $this->groupAvatar;
    }

    public function setGroupAvatar(?string $groupAvatar): void
    {
        $this->groupAvatar = $groupAvatar;
    }

    public function getGroupOwnerId(): ?string
    {
        return $this->groupOwnerId;
    }

    public function setGroupOwnerId(?string $groupOwnerId): void
    {
        $this->groupOwnerId = $groupOwnerId;
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

    public function getGroupId(): ?string
    {
        return $this->groupId;
    }

    public function setGroupId(?string $groupId): void
    {
        $this->groupId = $groupId;
    }

    protected function setMessageType(): void
    {
        $this->controlMessageType = ControlMessageType::GroupCreate;
    }
}
