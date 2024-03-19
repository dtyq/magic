<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO;

class MagicFlowEnabledAIModelDTO extends AbstractFlowDTO
{
    public string $value;

    public string $label = '';

    public string $icon = '';

    public array $tags = [];

    public array $configs = [];

    public bool $vision = false;

    public function getLabel(): string
    {
        return $this->label;
    }

    public function setLabel(?string $label): void
    {
        $this->label = $label ?? '';
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function setValue(?string $value): void
    {
        $this->value = $value ?? '';
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(?array $tags): void
    {
        $this->tags = $tags ?? [];
    }

    public function getConfigs(): array
    {
        return $this->configs;
    }

    public function setConfigs(?array $configs): void
    {
        $this->configs = $configs ?? [];
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function isVision(): bool
    {
        return $this->vision;
    }

    public function setVision(?bool $vision): void
    {
        $this->vision = $vision ?? false;
    }
}
