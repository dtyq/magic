<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO\Extra\Item;

use App\Infrastructure\Core\AbstractDTO;

class AgentItemDTO extends AbstractDTO
{
    public string $agentId;

    public ?string $name;

    public ?string $avatar;

    public function __construct(null|array|string $data = null)
    {
        // 兼容前端传参
        is_string($data) && $data = ['agent_id' => $data];
        parent::__construct($data);
    }

    public function getAgentId(): string
    {
        return $this->agentId;
    }

    public function setAgentId(string $agentId): self
    {
        $this->agentId = $agentId;
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

    public function getAvatar(): ?string
    {
        return $this->avatar;
    }

    public function setAvatar(?string $avatar): self
    {
        $this->avatar = $avatar;
        return $this;
    }
}
