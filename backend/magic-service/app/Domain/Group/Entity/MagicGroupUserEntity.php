<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity;

use ArrayAccess;

final class MagicGroupUserEntity extends AbstractEntity implements ArrayAccess
{
    protected string $id;

    protected string $groupId;

    protected string $userId;

    protected int $userRole;

    protected int $userType;

    protected int $status;

    protected string $organizationCode;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        if (is_int($id)) {
            $id = (string) $id;
        }
        $this->id = $id;
    }

    public function getGroupId(): string
    {
        return $this->groupId;
    }

    public function setGroupId(int|string $groupId): void
    {
        if (is_int($groupId)) {
            $groupId = (string) $groupId;
        }
        $this->groupId = $groupId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getUserRole(): int
    {
        return $this->userRole;
    }

    public function setUserRole(int $userRole): void
    {
        $this->userRole = $userRole;
    }

    public function getUserType(): int
    {
        return $this->userType;
    }

    public function setUserType(int $userType): void
    {
        $this->userType = $userType;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }
}
