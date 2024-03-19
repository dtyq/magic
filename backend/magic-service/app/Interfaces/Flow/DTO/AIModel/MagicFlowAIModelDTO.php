<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\AIModel;

use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class MagicFlowAIModelDTO extends AbstractFlowDTO
{
    public string $name;

    public string $label = '';

    public string $icon = '';

    public string $modelName = '';

    public array $tags = [];

    public array $defaultConfigs = [];

    public bool $enabled = true;

    public bool $display = true;

    public string $implementation = '';

    public array $implementationConfig = [];

    public bool $supportEmbedding = false;

    public bool $supportMultiModal = true;

    public int $vectorSize = 0;

    public int $maxTokens = 0;

    public string $organizationCode;

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function setModelName(?string $modelName): MagicFlowAIModelDTO
    {
        $this->modelName = $modelName ?? '';
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function isDisplay(): bool
    {
        return $this->display;
    }

    public function setDisplay(?bool $display): void
    {
        $this->display = $display ?? true;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function setLabel(?string $label): void
    {
        $this->label = $label ?? '';
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(?array $tags): void
    {
        $this->tags = $tags ?? [];
    }

    public function getDefaultConfigs(): array
    {
        return $this->defaultConfigs;
    }

    public function setDefaultConfigs(?array $defaultConfigs): void
    {
        $this->defaultConfigs = $defaultConfigs ?? [];
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled ?? true;
    }

    public function getImplementation(): string
    {
        return $this->implementation;
    }

    public function setImplementation(?string $implementation): void
    {
        $this->implementation = $implementation ?? '';
    }

    public function getImplementationConfig(): array
    {
        return $this->implementationConfig;
    }

    public function setImplementationConfig(?array $implementationConfig): void
    {
        $this->implementationConfig = $implementationConfig ?? [];
    }

    public function isSupportEmbedding(): bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(?bool $supportEmbedding): void
    {
        $this->supportEmbedding = $supportEmbedding ?? false;
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    public function setVectorSize(?int $vectorSize): void
    {
        $this->vectorSize = $vectorSize ?? 0;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode ?? '';
    }

    public function getMaxTokens(): int
    {
        return $this->maxTokens;
    }

    public function setMaxTokens(?int $maxTokens): void
    {
        $this->maxTokens = $maxTokens ?? 0;
    }

    public function isSupportMultiModal(): bool
    {
        return $this->supportMultiModal;
    }

    public function setSupportMultiModal(?bool $supportMultiModal): void
    {
        $this->supportMultiModal = $supportMultiModal ?? true;
    }
}
