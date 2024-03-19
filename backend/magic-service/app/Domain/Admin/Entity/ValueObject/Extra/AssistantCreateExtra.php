<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Extra;

use App\Domain\Admin\Entity\ValueObject\Item\Member\MemberItem;

class AssistantCreateExtra extends AbstractSettingExtra
{
    protected PermissionRange $permissionRange = PermissionRange::ALL;

    /**
     * @var array<MemberItem>
     */
    protected array $selectedMembers = [];

    public function getSelectedMembers(): array
    {
        return $this->selectedMembers;
    }

    /**
     * @param array<array|MemberItem> $selectedMembers
     * @return $this
     */
    public function setSelectedMembers(array $selectedMembers): self
    {
        $selectedMembers = array_map(fn ($item) => is_array($item) ? new MemberItem($item) : $item, $selectedMembers);
        $this->selectedMembers = $selectedMembers;
        return $this;
    }

    public function getPermissionRange(): PermissionRange
    {
        return $this->permissionRange;
    }

    public function setPermissionRange(int|PermissionRange $permissionRange): AssistantCreateExtra
    {
        is_int($permissionRange) && $permissionRange = PermissionRange::from($permissionRange);
        $this->permissionRange = $permissionRange;
        return $this;
    }
}
