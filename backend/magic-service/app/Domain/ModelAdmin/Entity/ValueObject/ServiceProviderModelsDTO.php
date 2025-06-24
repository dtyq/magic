<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Entity\ValueObject;

use App\Domain\ModelAdmin\Entity\AbstractEntity;

class ServiceProviderModelsDTO extends AbstractEntity
{
    protected string $id;

    protected string $serviceProviderConfigId; // 服务商配置ID

    protected string $modelId = ''; // 模型真实ID

    protected string $name;

    protected string $modelVersion;

    protected string $description;

    protected string $icon;

    protected int $modelType;

    protected string $category;

    protected ?ModelConfig $config = null;

    protected int $status;

    protected ?string $disabledBy = null; // 禁用来源：official-官方禁用，user-用户禁用，NULL-未禁用

    protected int $sort;

    protected string $createdAt;

    protected array $translate = [];

    protected array $visibleOrganizations = [];

    protected array $visibleApplications = [];

    public function getDisabledBy(): ?string
    {
        return $this->disabledBy;
    }

    public function setDisabledBy(?string $disabledBy): self
    {
        $this->disabledBy = $disabledBy;
        return $this;
    }

    public function isActive(): bool
    {
        return $this->status === 1;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getConfig(): ?ModelConfig
    {
        return $this->config;
    }

    public function setConfig(null|array|ModelConfig $config): void
    {
        if (is_array($config)) {
            $config = new ModelConfig($config);
        }
        $this->config = $config;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
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

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(string $modelVersion): void
    {
        $this->modelVersion = $modelVersion;
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

    public function getModelType(): int
    {
        return $this->modelType;
    }

    public function setModelType(int $modelType): void
    {
        $this->modelType = $modelType;
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

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    public function getServiceProviderConfigId(): string
    {
        return $this->serviceProviderConfigId;
    }

    public function setServiceProviderConfigId(int|string $serviceProviderConfigId): void
    {
        $this->serviceProviderConfigId = (string) $serviceProviderConfigId;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(array $translate): void
    {
        $this->translate = $translate;
    }

    public function getVisibleOrganizations(): array
    {
        return $this->visibleOrganizations;
    }

    public function setVisibleOrganizations(array $visibleOrganizations): void
    {
        $this->visibleOrganizations = $visibleOrganizations;
    }

    public function getVisibleApplications(): array
    {
        return $this->visibleApplications;
    }

    public function setVisibleApplications(array $visibleApplications): void
    {
        $this->visibleApplications = $visibleApplications;
    }
}
