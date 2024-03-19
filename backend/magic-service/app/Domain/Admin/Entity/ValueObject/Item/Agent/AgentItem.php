<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity\ValueObject\Item\Agent;

use App\Infrastructure\Core\AbstractValueObject;

class AgentItem extends AbstractValueObject
{
    public string $agentId;

    public string $name;

    public string $avatar;

    public function getAgentId(): string
    {
        return $this->agentId;
    }

    public function setAgentId(string $agentId): AgentItem
    {
        $this->agentId = $agentId;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): AgentItem
    {
        $this->name = $name;
        return $this;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function setAvatar(string $avatar): AgentItem
    {
        $this->avatar = $avatar;
        return $this;
    }
}
