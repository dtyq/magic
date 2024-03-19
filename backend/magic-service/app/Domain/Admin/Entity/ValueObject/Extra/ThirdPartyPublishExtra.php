<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Extra;

use App\Domain\Admin\Entity\ValueObject\Item\Agent\AgentItem;

class ThirdPartyPublishExtra extends AbstractSettingExtra
{
    protected PermissionRange $permissionRange = PermissionRange::ALL;

    /** @var array<AgentItem> */
    protected array $selectedAgents = [];

    public function getSelectedAgents(): array
    {
        return $this->selectedAgents;
    }

    /**
     * @param array<AgentItem|array> $selectedAgents
     * @return $this
     */
    public function setSelectedAgents(array $selectedAgents): self
    {
        $selectedAgents = array_map(fn ($item) => is_array($item) ? new AgentItem($item) : $item, $selectedAgents);
        $this->selectedAgents = $selectedAgents;
        return $this;
    }

    public function getPermissionRange(): PermissionRange
    {
        return $this->permissionRange;
    }

    public function setPermissionRange(int|PermissionRange $permissionRange): ThirdPartyPublishExtra
    {
        is_int($permissionRange) && $permissionRange = PermissionRange::from($permissionRange);
        $this->permissionRange = $permissionRange;
        return $this;
    }
}
