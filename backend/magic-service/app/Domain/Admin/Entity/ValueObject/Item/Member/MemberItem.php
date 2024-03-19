<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Item\Member;

use App\Infrastructure\Core\AbstractValueObject;

class MemberItem extends AbstractValueObject
{
    public MemberType $memberType;

    public string $memberId;

    public string $avatar;

    public string $name;

    public function getMemberType(): MemberType
    {
        return $this->memberType;
    }

    public function setMemberType(int|MemberType $memberType): MemberItem
    {
        is_int($memberType) && $memberType = MemberType::from($memberType);
        $this->memberType = $memberType;
        return $this;
    }

    public function getMemberId(): string
    {
        return $this->memberId;
    }

    public function setMemberId(string $memberId): MemberItem
    {
        $this->memberId = $memberId;
        return $this;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): MemberItem
    {
        $this->avatar = $avatar;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): MemberItem
    {
        $this->name = $name;
        return $this;
    }
}
