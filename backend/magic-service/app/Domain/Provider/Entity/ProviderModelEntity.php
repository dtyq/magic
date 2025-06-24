<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\DisabledByType;
use App\Domain\Provider\Entity\ValueObject\ModelConfigVO;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class ProviderModelEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $providerConfigId;

    protected string $name = '';

    protected string $modelVersion = '';

    protected Category $category;

    protected string $modelId = '';

    protected ModelType $modelType;

    protected ModelConfigVO $config;

    protected ?string $description = null;

    protected int $sort = 0;

    protected string $icon = '';

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected string $organizationCode = '';

    protected Status $status;

    protected ?DisabledByType $disabledBy = null;

    protected array $translate = [];

    protected int $modelParentId = 0;

    protected array $visibleOrganizations = [];

    protected array $visibleApplications = [];

    protected bool $isOffice = false;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getProviderConfigId(): int
    {
        return $this->providerConfigId;
    }

    public function setProviderConfigId(int $providerConfigId): self
    {
        $this->providerConfigId = $providerConfigId;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(string $modelVersion): self
    {
        $this->modelVersion = $modelVersion;
        return $this;
    }

    public function getCategory(): Category
    {
        return $this->category;
    }

    public function setCategory(Category $category): self
    {
        $this->category = $category;
        return $this;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }

    public function getModelType(): ModelType
    {
        return $this->modelType;
    }

    public function setModelType(ModelType $modelType): self
    {
        $this->modelType = $modelType;
        return $this;
    }

    public function getConfig(): ModelConfigVO
    {
        return $this->config;
    }

    public function setConfig(array|ModelConfigVO $config): self
    {
        if (is_array($config)) {
            $this->config = new ModelConfigVO($config);
        } else {
            $this->config = $config;
        }
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;
        return $this;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): self
    {
        $this->sort = $sort;
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): self
    {
        $this->icon = $icon;
        return $this;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?DateTime $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTime $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getStatus(): Status
    {
        return $this->status;
    }

    public function setStatus(Status $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getDisabledBy(): ?DisabledByType
    {
        return $this->disabledBy;
    }

    public function setDisabledBy(?DisabledByType $disabledBy): self
    {
        $this->disabledBy = $disabledBy;
        return $this;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(array $translate): self
    {
        $this->translate = $translate;
        return $this;
    }

    public function getModelParentId(): int
    {
        return $this->modelParentId;
    }

    public function setModelParentId(int $modelParentId): self
    {
        $this->modelParentId = $modelParentId;
        return $this;
    }

    public function getVisibleOrganizations(): array
    {
        return $this->visibleOrganizations;
    }

    public function setVisibleOrganizations(array $visibleOrganizations): self
    {
        $this->visibleOrganizations = $visibleOrganizations;
        return $this;
    }

    public function getVisibleApplications(): array
    {
        return $this->visibleApplications;
    }

    public function setVisibleApplications(array $visibleApplications): self
    {
        $this->visibleApplications = $visibleApplications;
        return $this;
    }

    public function getIsOffice(): bool
    {
        return $this->isOffice;
    }

    public function isOffice(): bool
    {
        return $this->isOffice;
    }

    public function setIsOffice(bool $isOffice): self
    {
        $this->isOffice = $isOffice;
        return $this;
    }
}
