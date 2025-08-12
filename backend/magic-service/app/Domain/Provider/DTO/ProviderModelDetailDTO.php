<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO;

use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\DisabledByType;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractDTO;
use Hyperf\Codec\Json;

/**
 * 服务商下面单个模型详情的 dto.
 */
class ProviderModelDetailDTO extends AbstractDTO
{
    protected string $id;

    protected string $serviceProviderConfigId; // 服务商配置ID

    protected string $modelId = ''; // 模型真实ID

    protected string $name;

    protected string $modelVersion;

    protected string $description;

    protected string $icon;

    protected ModelType $modelType;

    protected Category $category;

    protected ?ModelConfigItem $config = null;

    protected Status $status;

    protected ?DisabledByType $disabledBy = null; // 禁用来源：official-官方禁用，user-用户禁用，NULL-未禁用

    protected int $superMagicDisplayState = 0;

    protected ?int $loadBalancingWeight = null;

    protected int $sort;

    protected string $createdAt;

    protected array $translate = [];

    protected array $visibleOrganizations = [];

    protected array $visibleApplications = [];

    protected array $visiblePackages = [];

    public function getDisabledBy(): ?DisabledByType
    {
        return $this->disabledBy;
    }

    public function setDisabledBy(null|DisabledByType|int|string $disabledBy): self
    {
        if ($disabledBy === null || $disabledBy === '') {
            $this->disabledBy = null;
        } elseif ($disabledBy instanceof DisabledByType) {
            $this->disabledBy = $disabledBy;
        } else {
            $this->disabledBy = DisabledByType::from((string) $disabledBy);
        }
        return $this;
    }

    public function isActive(): bool
    {
        return $this->status === Status::Enabled;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(null|int|string $createdAt): void
    {
        if ($createdAt === null) {
            $this->createdAt = '';
        } else {
            $this->createdAt = (string) $createdAt;
        }
    }

    public function getConfig(): ?ModelConfigItem
    {
        return $this->config;
    }

    public function setConfig(null|array|ModelConfigItem|string $config): void
    {
        if ($config === null) {
            $this->config = null;
        } elseif (is_string($config)) {
            $decoded = Json::decode($config);
            $this->config = new ModelConfigItem(is_array($decoded) ? $decoded : []);
        } elseif (is_array($config)) {
            $this->config = new ModelConfigItem($config);
        } else {
            $this->config = $config;
        }
    }

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

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(null|int|string $modelVersion): void
    {
        if ($modelVersion === null) {
            $this->modelVersion = '';
        } else {
            $this->modelVersion = (string) $modelVersion;
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

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(null|int|string $icon): void
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
    }

    public function getModelType(): ModelType
    {
        return $this->modelType;
    }

    public function setModelType(null|int|ModelType|string $modelType): void
    {
        if ($modelType === null || $modelType === '') {
            $this->modelType = ModelType::LLM;
        } elseif ($modelType instanceof ModelType) {
            $this->modelType = $modelType;
        } else {
            $this->modelType = ModelType::from((int) $modelType);
        }
    }

    public function getCategory(): Category
    {
        return $this->category;
    }

    public function setCategory(null|Category|int|string $category): void
    {
        if ($category === null || $category === '') {
            $this->category = Category::LLM;
        } elseif ($category instanceof Category) {
            $this->category = $category;
        } else {
            $this->category = Category::from((string) $category);
        }
    }

    public function getStatus(): Status
    {
        return $this->status;
    }

    public function setStatus(null|int|Status|string $status): void
    {
        if ($status === null || $status === '') {
            $this->status = Status::Disabled;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } else {
            $this->status = Status::from((int) $status);
        }
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): void
    {
        if ($sort === null) {
            $this->sort = 0;
        } else {
            $this->sort = (int) $sort;
        }
    }

    public function getServiceProviderConfigId(): string
    {
        return $this->serviceProviderConfigId;
    }

    public function setServiceProviderConfigId(null|int|string $serviceProviderConfigId): void
    {
        if ($serviceProviderConfigId === null) {
            $this->serviceProviderConfigId = '';
        } else {
            $this->serviceProviderConfigId = (string) $serviceProviderConfigId;
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

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(null|array|string $translate): void
    {
        if ($translate === null) {
            $this->translate = [];
        } elseif (is_string($translate)) {
            $decoded = Json::decode($translate);
            $this->translate = is_array($decoded) ? $decoded : [];
        } else {
            $this->translate = $translate;
        }
    }

    public function getVisibleOrganizations(): array
    {
        return $this->visibleOrganizations;
    }

    public function setVisibleOrganizations(null|array|string $visibleOrganizations): void
    {
        if ($visibleOrganizations === null) {
            $this->visibleOrganizations = [];
        } elseif (is_string($visibleOrganizations)) {
            $decoded = Json::decode($visibleOrganizations);
            $this->visibleOrganizations = is_array($decoded) ? $decoded : [];
        } else {
            $this->visibleOrganizations = $visibleOrganizations;
        }
    }

    public function getVisibleApplications(): array
    {
        return $this->visibleApplications;
    }

    public function setVisibleApplications(null|array|string $visibleApplications): void
    {
        if ($visibleApplications === null) {
            $this->visibleApplications = [];
        } elseif (is_string($visibleApplications)) {
            $decoded = Json::decode($visibleApplications);
            $this->visibleApplications = is_array($decoded) ? $decoded : [];
        } else {
            $this->visibleApplications = $visibleApplications;
        }
    }

    public function getSuperMagicDisplayState(): int
    {
        return $this->superMagicDisplayState;
    }

    public function setSuperMagicDisplayState(null|int|string $superMagicDisplayState): void
    {
        if ($superMagicDisplayState === null) {
            $this->superMagicDisplayState = 0;
        } else {
            $this->superMagicDisplayState = (int) $superMagicDisplayState;
        }
    }

    public function getLoadBalancingWeight(): ?int
    {
        return $this->loadBalancingWeight;
    }

    public function setLoadBalancingWeight(null|int|string $loadBalancingWeight): void
    {
        if ($loadBalancingWeight === null) {
            $this->loadBalancingWeight = null;
        } else {
            $this->loadBalancingWeight = (int) $loadBalancingWeight;
        }
    }

    public function getVisiblePackages(): array
    {
        return $this->visiblePackages;
    }

    public function setVisiblePackages(null|array|string $visiblePackages): void
    {
        if ($visiblePackages === null) {
            $this->visiblePackages = [];
        } elseif (is_string($visiblePackages)) {
            $decoded = Json::decode($visiblePackages);
            $this->visiblePackages = is_array($decoded) ? $decoded : [];
        } else {
            $this->visiblePackages = $visiblePackages;
        }
    }
}
