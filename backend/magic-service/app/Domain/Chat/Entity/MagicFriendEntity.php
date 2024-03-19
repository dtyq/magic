<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

use App\Domain\Chat\Entity\ValueObject\FriendStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;

final class MagicFriendEntity extends AbstractEntity
{
    protected string $id;

    protected string $userId;

    protected string $userOrganizationCode;

    protected string $friendId;

    protected string $friendOrganizationCode;

    protected string $remarks;

    protected string $extra;

    protected FriendStatus $status;

    protected UserType $friendType;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    public function getFriendType(): UserType
    {
        return $this->friendType;
    }

    public function setFriendType(int|UserType $friendType): void
    {
        if (is_int($friendType)) {
            $friendType = UserType::tryFrom($friendType);
        }
        $this->friendType = $friendType;
    }

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

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(int|string $userId): void
    {
        if (is_int($userId)) {
            $userId = (string) $userId;
        }
        $this->userId = $userId;
    }

    public function getUserOrganizationCode(): string
    {
        return $this->userOrganizationCode;
    }

    public function setUserOrganizationCode(string $userOrganizationCode): void
    {
        $this->userOrganizationCode = $userOrganizationCode;
    }

    public function getFriendId(): string
    {
        return $this->friendId;
    }

    public function setFriendId(string $friendId): void
    {
        $this->friendId = $friendId;
    }

    public function getFriendOrganizationCode(): string
    {
        return $this->friendOrganizationCode;
    }

    public function setFriendOrganizationCode(string $friendOrganizationCode): void
    {
        $this->friendOrganizationCode = $friendOrganizationCode;
    }

    public function getRemarks(): string
    {
        return $this->remarks;
    }

    public function setRemarks(string $remarks): void
    {
        $this->remarks = $remarks;
    }

    public function getExtra(): string
    {
        return $this->extra;
    }

    public function setExtra(string $extra): void
    {
        $this->extra = $extra;
    }

    public function getStatus(): FriendStatus
    {
        return $this->status;
    }

    public function setStatus(FriendStatus|int $status): void
    {
        if (is_int($status)) {
            $status = FriendStatus::tryFrom($status);
        }
        $this->status = $status;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }
}
