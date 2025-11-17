<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

use App\Infrastructure\Core\AbstractDTO;

class SuperMagicAgentListDTO extends AbstractDTO
{
    /**
     * Agent代码.
     */
    public string $id = '';

    /**
     * Agent名称.
     */
    public string $name = '';

    /**
     * Agent描述.
     */
    public string $description = '';

    /**
     * Agent图标.
     * 格式: {"url": "...", "type": "...", "color": "..."}
     */
    public array $icon = [];

    /**
     * 图标类型 1:图标 2:图片.
     */
    public int $iconType = 1;

    /**
     * 智能体类型：1-内置，2-自定义.
     */
    public int $type = 2;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
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

    public function getIcon(): array
    {
        return $this->icon;
    }

    public function setIcon(?array $icon): void
    {
        $this->icon = $icon ?? [];
    }

    public function getIconType(): int
    {
        return $this->iconType;
    }

    public function setIconType(?int $iconType): void
    {
        $this->iconType = $iconType ?? 1;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }
}
