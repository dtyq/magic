<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Extra;

use App\Domain\Admin\Entity\ValueObject\Extra\PermissionRange;
use App\Domain\Admin\Entity\ValueObject\Item\Member\MemberItem;
use App\Interfaces\Admin\DTO\Extra\Item\MemberItemDTO;

class AssistantCreateExtraDTO extends AbstractSettingExtraDTO
{
    protected PermissionRange $permissionRange;

    /**
     * @var array<MemberItemDTO>
     */
    protected array $selectedMembers = [];

    public function getSelectedMembers(): array
    {
        return $this->selectedMembers;
    }

    /**
     * @param array<array|MemberItem|MemberItemDTO> $selectedMembers
     * @return $this
     */
    public function setSelectedMembers(array $selectedMembers): AssistantCreateExtraDTO
    {
        $this->selectedMembers = [];
        foreach ($selectedMembers as $selectedMember) {
            switch ($selectedMember) {
                case is_array($selectedMember):
                    $selectedMember = new MemberItemDTO($selectedMember);
                    break;
                case $selectedMember instanceof MemberItem:
                    $selectedMember = new MemberItemDTO($selectedMember->toArray());
                    break;
            }
            $this->selectedMembers[] = $selectedMember;
        }
        return $this;
    }

    public function getPermissionRange(): PermissionRange
    {
        return $this->permissionRange;
    }

    public function setPermissionRange(int|PermissionRange $permissionRange): self
    {
        is_int($permissionRange) && $permissionRange = PermissionRange::from($permissionRange);
        $this->permissionRange = $permissionRange;
        return $this;
    }
}
