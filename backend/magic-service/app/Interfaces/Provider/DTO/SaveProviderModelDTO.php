<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;

class SaveProviderModelDTO extends AbstractDTO
{
    protected ?string $id;

    protected ?string $serviceProviderConfigId;

    protected ?string $modelId;

    protected ?string $name;

    protected ?string $modelVersion;

    protected ?string $description;

    protected ?string $organizationCode;

    protected ?Category $category;

    protected ?string $icon;

    protected ?ModelType $modelType;

    protected ?ModelConfigItem $config;

    protected ?Status $status;

    protected ?int $superMagicDisplayState;

    protected ?int $sort;

    protected ?array $translate;

    protected ?int $loadBalancingWeight;

    protected ?array $visibleOrganizations;

    protected ?array $visibleApplications;

    protected ?array $visiblePackages;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getId(): ?string
    {
        return $this->id ?? null;
    }

    public function setId(int|string|null $id): void
    {
        if (is_numeric($id)) {
            $this->id = (string) $id;
        } else {
            $this->id = $id;
        }
    }

    public function getServiceProviderConfigId(): ?string
    {
        return $this->serviceProviderConfigId ?? null;
    }

    public function setServiceProviderConfigId(int|string|null $serviceProviderConfigId): void
    {
        if ($serviceProviderConfigId === null) {
            $this->serviceProviderConfigId = null;
        } else {
            $this->serviceProviderConfigId = (string) $serviceProviderConfigId;
        }
    }

    public function getModelId(): ?string
    {
        return $this->modelId ?? null;
    }

    public function setModelId(int|string|null $modelId): void
    {
        if ($modelId === null) {
            $this->modelId = null;
        } else {
            $this->modelId = (string) $modelId;
        }
    }

    public function getName(): ?string
    {
        return $this->name ?? null;
    }

    public function setName(int|string|null $name): void
    {
        if ($name === null) {
            $this->name = null;
        } else {
            $this->name = (string) $name;
        }
    }

    public function getModelVersion(): ?string
    {
        return $this->modelVersion ?? null;
    }

    public function setModelVersion(int|string|null $modelVersion): void
    {
        if ($modelVersion === null) {
            $this->modelVersion = null;
        } else {
            $this->modelVersion = (string) $modelVersion;
        }
    }

    public function getDescription(): ?string
    {
        return $this->description ?? null;
    }

    public function setDescription(int|string|null $description): void
    {
        if ($description === null) {
            $this->description = null;
        } else {
            $this->description = (string) $description;
        }
    }

    public function getIcon(): ?string
    {
        return $this->icon ?? null;
    }

    public function setIcon(int|string|null $icon): void
    {
        if ($icon === null) {
            $this->icon = null;
        } else {
            $icon = (string) $icon;
            $icon = FileAssembler::formatPath($icon);
            $this->icon = $icon;
        }
    }

    public function getConfig(): ?ModelConfigItem
    {
        return $this->config ?? null;
    }

    public function setConfig(array|ModelConfigItem|string|null $config): void
    {
        if ($config instanceof ModelConfigItem) {
            $this->config = $config;
        } elseif (is_string($config) && json_validate($config)) {
            $decoded = json_decode($config, true);
            $this->config = new ModelConfigItem(is_array($decoded) ? $decoded : []);
        } elseif (is_array($config)) {
            $this->config = new ModelConfigItem($config);
        } else {
            $this->config = null;
        }
    }

    public function getSuperMagicDisplayState(): ?int
    {
        return $this->superMagicDisplayState ?? null;
    }

    public function setSuperMagicDisplayState(bool|int|string|null $superMagicDisplayState): void
    {
        if ($superMagicDisplayState === null) {
            $this->superMagicDisplayState = null;
        } else {
            $this->superMagicDisplayState = (int) $superMagicDisplayState;
        }
    }

    public function getSort(): ?int
    {
        return $this->sort ?? null;
    }

    public function setSort(int|string|null $sort): void
    {
        if ($sort === null) {
            $this->sort = null;
        } else {
            $this->sort = (int) $sort;
        }
    }

    public function getTranslate(): ?array
    {
        return $this->translate ?? null;
    }

    public function setTranslate(array|string|null $translate): void
    {
        if ($translate === null) {
            $this->translate = null;
        } elseif (is_string($translate)) {
            $decoded = json_decode($translate, true);
            $this->translate = is_array($decoded) ? $decoded : [];
        } else {
            $this->translate = $translate;
        }
    }

    public function getVisibleOrganizations(): ?array
    {
        return $this->visibleOrganizations ?? null;
    }

    public function setVisibleOrganizations(array|string|null $visibleOrganizations): void
    {
        if ($visibleOrganizations === null) {
            $this->visibleOrganizations = null;
        } elseif (is_string($visibleOrganizations)) {
            $decoded = json_decode($visibleOrganizations, true);
            $this->visibleOrganizations = is_array($decoded) ? $decoded : [];
        } else {
            $this->visibleOrganizations = $visibleOrganizations;
        }
    }

    public function getVisibleApplications(): ?array
    {
        return $this->visibleApplications ?? null;
    }

    public function setVisibleApplications(array|string|null $visibleApplications): void
    {
        if ($visibleApplications === null) {
            $this->visibleApplications = null;
        } elseif (is_string($visibleApplications)) {
            $decoded = json_decode($visibleApplications, true);
            $this->visibleApplications = is_array($decoded) ? $decoded : [];
        } else {
            $this->visibleApplications = $visibleApplications;
        }
    }

    public function getLoadBalancingWeight(): ?int
    {
        return $this->loadBalancingWeight ?? null;
    }

    public function setLoadBalancingWeight(int|string|null $loadBalancingWeight): void
    {
        if ($loadBalancingWeight === null) {
            $this->loadBalancingWeight = null;
        } else {
            $this->loadBalancingWeight = (int) $loadBalancingWeight;
        }
    }

    public function getVisiblePackages(): ?array
    {
        return $this->visiblePackages ?? null;
    }

    public function setVisiblePackages(array|string|null $visiblePackages): void
    {
        if ($visiblePackages === null) {
            $this->visiblePackages = null;
        } elseif (is_string($visiblePackages)) {
            $decoded = json_decode($visiblePackages, true);
            $this->visiblePackages = is_array($decoded) ? $decoded : [];
        } else {
            $this->visiblePackages = $visiblePackages;
        }
    }

    public function getModelType(): ?ModelType
    {
        return $this->modelType ?? null;
    }

    public function setModelType(int|ModelType|string|null $modelType): void
    {
        if ($modelType === null || $modelType === '') {
            $this->modelType = null;
        } elseif ($modelType instanceof ModelType) {
            $this->modelType = $modelType;
        } else {
            $this->modelType = ModelType::from((int) $modelType);
        }
    }

    public function getStatus(): ?Status
    {
        return $this->status ?? null;
    }

    public function setStatus(int|Status|string|null $status): void
    {
        if ($status === null || $status === '') {
            $this->status = null;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } else {
            $this->status = Status::from((int) $status);
        }
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode ?? null;
    }

    public function setOrganizationCode(int|string|null $organizationCode): void
    {
        if ($organizationCode === null) {
            $this->organizationCode = null;
        } else {
            $this->organizationCode = (string) $organizationCode;
        }
    }

    public function getCategory(): ?Category
    {
        return $this->category ?? null;
    }

    public function setCategory(Category|int|string|null $category): void
    {
        if ($category === null || $category === '') {
            $this->category = null;
        } elseif ($category instanceof Category) {
            $this->category = $category;
        } else {
            $this->category = Category::from((string) $category);
        }
    }
}
