<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO;

use App\Domain\Chat\Entity\AbstractEntity;

class UserGroupConversationQueryDTO extends AbstractEntity
{
    protected string $organizationCode = '';

    protected string $groupId = '';

    protected string $userId = '';

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): UserGroupConversationQueryDTO
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getGroupId(): string
    {
        return $this->groupId;
    }

    public function setGroupId(string $groupId): UserGroupConversationQueryDTO
    {
        $this->groupId = $groupId;
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): UserGroupConversationQueryDTO
    {
        $this->userId = $userId;
        return $this;
    }
}
