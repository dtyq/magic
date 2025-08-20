<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * SuperMagic 模型简化 DTO，只包含必要字段.
 */
class SuperMagicModelDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $modelId = '';

    protected string $name = '';

    protected string $icon = '';

    protected string $description = '';

    protected ?int $loadBalancingWeight = null;

    protected ?SuperMagicProviderDTO $provider = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if ($id === null) {
            $this->id = '';
        } else {
            $this->id = (string) $id;
        }
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(null|int|string $modelId): void
    {
        if ($modelId === null) {
            $this->modelId = '';
        } else {
            $this->modelId = (string) $modelId;
        }
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(null|int|string $name): void
    {
        if ($name === null) {
            $this->name = '';
        } else {
            $this->name = (string) $name;
        }
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(null|int|string $description): void
    {
        if ($description === null) {
            $this->description = '';
        } else {
            $this->description = (string) $description;
        }
    }

    public function getProvider(): ?SuperMagicProviderDTO
    {
        return $this->provider;
    }

    public function setProvider(?SuperMagicProviderDTO $provider): void
    {
        $this->provider = $provider;
    }

    public function getLoadBalancingWeight(): ?int
    {
        return $this->loadBalancingWeight;
    }

    public function setLoadBalancingWeight(?int $loadBalancingWeight): void
    {
        $this->loadBalancingWeight = $loadBalancingWeight;
    }
}
