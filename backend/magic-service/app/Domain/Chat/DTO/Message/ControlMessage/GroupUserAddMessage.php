<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ControlMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use Hyperf\Codec\Json;

class GroupUserAddMessage extends AbstractControlMessageStruct
{
    protected ?string $operateUserId = null;

    protected ?string $groupId = null;

    protected ?string $conversationId = null;

    protected array $userIds = [];

    public function __construct(?array $messageStruct = null)
    {
        if (! empty($messageStruct['user_ids'])) {
            if (is_string($messageStruct['user_ids'])) {
                $messageStruct['user_ids'] = Json::decode($messageStruct['user_ids']);
            }
            $messageStruct['user_ids'] = array_values(array_unique($messageStruct['user_ids']));
        }
        parent::__construct($messageStruct);
    }

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
        $this->controlMessageType = ControlMessageType::GroupUsersAdd;
    }
}
