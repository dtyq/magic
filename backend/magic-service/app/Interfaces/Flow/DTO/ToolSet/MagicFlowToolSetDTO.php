<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\ToolSet;

use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class MagicFlowToolSetDTO extends AbstractFlowDTO
{
    /**
     * 工具集名称.
     */
    public string $name = '';

    /**
     * 工具集描述.
     */
    public string $description = '';

    /**
     * 工具集图标.
     */
    public string $icon = '';

    /**
     * 用于冗余工具的信息列表.
     */
    public array $tools = [];

    /**
     * 引用数量.
     * 被 n 个助理应用.
     */
    public int $agentUsedCount = 0;

    public ?bool $enabled = null;

    public int $userOperation = 0;

    public function getAgentUsedCount(): int
    {
        return $this->agentUsedCount;
    }

    public function setAgentUsedCount(?int $agentUsedCount): void
    {
        $this->agentUsedCount = $agentUsedCount ?? 0;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description ?? '';
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function getTools(): array
    {
        return $this->tools;
    }

    public function setTools(?array $tools): void
    {
        $this->tools = $tools ?? [];
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(?int $userOperation): void
    {
        $this->userOperation = $userOperation ?? 0;
    }
}
