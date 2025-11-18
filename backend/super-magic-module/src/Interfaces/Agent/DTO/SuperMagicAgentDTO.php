<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;

class SuperMagicAgentDTO extends AbstractDTO
{
    use OperatorDTOTrait;
    use StringIdDTOTrait;

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
     * 格式: {"url": "...", "type": "...", "color": "..."}.
     */
    public array $icon = [];

    /**
     * 图标类型 1:图标 2:图片.
     */
    public int $iconType = 1;

    /**
     * 系统提示词.
     */
    public array $prompt = [];

    /**
     * 智能体类型：1-内置，2-自定义.
     */
    public int $type = 2;

    /**
     * 是否启用.
     */
    public ?bool $enabled = null;

    /**
     * 工具列表.
     */
    public array $tools = [];

    /**
     * 系统提示词纯文本格式.
     */
    public ?string $promptString = null;

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

    public function getPrompt(): array
    {
        return $this->prompt;
    }

    public function setPrompt(?array $prompt): void
    {
        $this->prompt = $prompt ?? [];
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }

    public function getTools(): array
    {
        return $this->tools;
    }

    public function setTools(?array $tools): void
    {
        $this->tools = $tools ?? [];
    }

    public function getPromptString(): ?string
    {
        return $this->promptString;
    }

    public function setPromptString(?string $promptString): void
    {
        $this->promptString = $promptString;
    }
}
