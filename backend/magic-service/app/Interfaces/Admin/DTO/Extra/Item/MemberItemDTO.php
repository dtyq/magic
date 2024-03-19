<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Extra\Item;

use App\Domain\Admin\Entity\ValueObject\Item\Member\MemberType;
use App\Infrastructure\Core\AbstractDTO;

class MemberItemDTO extends AbstractDTO
{
    public MemberType $memberType;

    public string $memberId;

    public ?string $avatar;

    public ?string $name;

    public function getMemberType(): MemberType
    {
        return $this->memberType;
    }

    public function setMemberType(int|MemberType $memberType): self
    {
        is_int($memberType) && $memberType = MemberType::from($memberType);
        $this->memberType = $memberType;
        return $this;
    }

    public function getMemberId(): string
    {
        return $this->memberId;
    }

    public function setMemberId(string $memberId): self
    {
        $this->memberId = $memberId;
        return $this;
    }

    public function getAvatar(): ?string
    {
        return $this->avatar;
    }

    public function setAvatar(?string $avatar): self
    {
        $this->avatar = $avatar;
        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): self
    {
        $this->name = $name;
        return $this;
    }
}
