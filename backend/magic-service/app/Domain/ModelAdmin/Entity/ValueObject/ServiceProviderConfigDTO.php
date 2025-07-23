<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Entity\ValueObject;

use App\Domain\ModelAdmin\Constant\Status;
use App\Infrastructure\Core\AbstractDTO;

class ServiceProviderConfigDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $name = '';

    protected string $description = '';

    protected string $icon = '';

    protected string $alias = '';

    protected string $serviceProviderId = '';

    protected ?ServiceProviderConfig $config = null;

    protected int $providerType;

    protected string $category = '';

    protected int $status;

    protected array $translate = [];

    protected bool $isModelsEnable;

    protected array $models = [];

    protected string $createdAt;

    protected string $providerCode;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        $this->id = (string) $id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getProviderCode(): string
    {
        return $this->providerCode;
    }

    public function setProviderCode(string $providerCode): void
    {
        $this->providerCode = $providerCode;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getProviderType(): int
    {
        return $this->providerType;
    }

    public function setProviderType(int $providerType): void
    {
        $this->providerType = $providerType;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(string $category): void
    {
        $this->category = $category;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function isEnabled(): bool
    {
        return $this->status === Status::ACTIVE->value;
    }

    /**
     * @return ServiceProviderModelsDTO[]
     */
    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): void
    {
        $this->models = $models;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getConfig(): ServiceProviderConfig
    {
        return $this->config;
    }

    public function setIsModelsEnable(bool $isModelsEnable): void
    {
        $this->isModelsEnable = $isModelsEnable;
    }

    public function getIsModelsEnable(): bool
    {
        return $this->isModelsEnable;
    }

    public function setConfig(null|array|ServiceProviderConfig $config): void
    {
        if (is_array($config)) {
            $config = new ServiceProviderConfig($config);
        }
        $this->config = $config;
    }

    public function getServiceProviderId(): string
    {
        return $this->serviceProviderId;
    }

    public function setServiceProviderId(int|string $serviceProviderId): void
    {
        $this->serviceProviderId = (string) $serviceProviderId;
    }

    public function getAlias(): string
    {
        return $this->alias;
    }

    public function setAlias(string $alias): void
    {
        $this->alias = $alias;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(array $translate): void
    {
        $this->translate = $translate;
    }
}
