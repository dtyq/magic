<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Extra;

use App\Domain\Admin\Entity\ValueObject\Extra\PermissionRange;
use App\Domain\Admin\Entity\ValueObject\Item\Agent\AgentItem;
use App\Interfaces\Admin\DTO\Extra\Item\AgentItemDTO;

class ThirdPartyPublishExtraDTO extends AbstractSettingExtraDTO
{
    protected PermissionRange $permissionRange;

    /** @var array<AgentItemDTO> */
    protected array $selectedAgents = [];

    public function getSelectedAgents(): array
    {
        return $this->selectedAgents;
    }

    /**
     * @param array<AgentItem|AgentItemDTO|array|string> $selectedAgents
     * @return $this
     */
    public function setSelectedAgents(array $selectedAgents): self
    {
        $this->selectedAgents = [];
        foreach ($selectedAgents as $selectedAgent) {
            switch ($selectedAgent) {
                case is_string($selectedAgent):
                case is_array($selectedAgent):
                    $selectedAgent = new AgentItemDTO($selectedAgent);
                    break;
                case $selectedAgent instanceof AgentItem:
                    $selectedAgent = new AgentItemDTO($selectedAgent->toArray());
                    break;
            }
            $this->selectedAgents[] = $selectedAgent;
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
