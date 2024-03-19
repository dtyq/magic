<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Group\Entity;

use App\Domain\Group\Entity\ValueObject\GroupStatusEnum;
use App\Domain\Group\Entity\ValueObject\GroupTypeEnum;

class MagicGroupEntity extends AbstractEntity
{
    protected string $id = '';

    protected string $groupOwner = '';

    protected string $organizationCode = '';

    protected ?string $groupName = null;

    protected ?string $groupAvatar = null;

    protected ?string $groupNotice = null;

    protected ?string $groupTag = null;

    protected GroupTypeEnum $groupType = GroupTypeEnum::Internal;

    protected GroupStatusEnum $groupStatus = GroupStatusEnum::Normal;

    protected ?int $memberLimit = null;

    public function getMemberLimit(): ?int
    {
        return $this->memberLimit;
    }

    public function setMemberLimit(?int $memberLimit): void
    {
        $this->memberLimit = $memberLimit;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        if (is_numeric($id)) {
            $this->id = (string) $id;
        }
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

    public function getGroupNotice(): ?string
    {
        return $this->groupNotice;
    }

    public function setGroupNotice(?string $groupNotice): void
    {
        $this->groupNotice = $groupNotice;
    }

    public function getGroupOwner(): string
    {
        return $this->groupOwner;
    }

    public function setGroupOwner(string $groupOwner): void
    {
        $this->groupOwner = $groupOwner;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getGroupTag(): ?string
    {
        return $this->groupTag;
    }

    public function setGroupTag(?string $groupTag): void
    {
        $this->groupTag = $groupTag;
    }

    public function getGroupType(): GroupTypeEnum
    {
        return $this->groupType;
    }

    public function setGroupType(GroupTypeEnum|int|string $groupType): void
    {
        if (is_numeric($groupType)) {
            $this->groupType = GroupTypeEnum::from($groupType);
        } else {
            $this->groupType = $groupType;
        }
    }

    public function getGroupStatus(): GroupStatusEnum
    {
        return $this->groupStatus;
    }

    public function setGroupStatus(GroupStatusEnum|int|string $groupStatus): void
    {
        if (is_numeric($groupStatus)) {
            $this->groupStatus = GroupStatusEnum::from($groupStatus);
        } else {
            $this->groupStatus = $groupStatus;
        }
    }
}
