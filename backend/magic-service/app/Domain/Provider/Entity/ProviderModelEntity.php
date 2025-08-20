<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\DisabledByType;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Hyperf\Codec\Json;

use function Hyperf\Translation\__;

class ProviderModelEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $serviceProviderConfigId;

    protected string $name = '';

    protected string $modelVersion = '';

    protected Category $category;

    protected string $modelId = '';

    protected ModelType $modelType;

    protected ?ModelConfigItem $config = null;

    protected ?string $description = '';

    protected int $sort = 0;

    protected string $icon = '';

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected ?DateTime $deletedAt = null;

    protected string $organizationCode = '';

    protected Status $status;

    protected ?DisabledByType $disabledBy = null;

    protected array $translate = [];

    protected int $modelParentId = 0;

    protected array $visibleOrganizations = [];

    protected array $visibleApplications = [];

    protected ?int $loadBalancingWeight = null;

    protected array $visiblePackages = [];

    protected bool $isOffice = false;

    protected int $superMagicDisplayState = 0;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        if (is_numeric($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = null;
        }

        return $this;
    }

    public function getServiceProviderConfigId(): int
    {
        return $this->serviceProviderConfigId;
    }

    public function setServiceProviderConfigId(null|int|string $serviceProviderConfigId): self
    {
        if (is_numeric($serviceProviderConfigId)) {
            $this->serviceProviderConfigId = (int) $serviceProviderConfigId;
        } else {
            $this->serviceProviderConfigId = 0;
        }
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(null|int|string $name): self
    {
        if ($name === null) {
            $this->name = '';
        } else {
            $this->name = (string) $name;
        }
        return $this;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function setModelVersion(null|int|string $modelVersion): self
    {
        if ($modelVersion === null) {
            $this->modelVersion = '';
        } else {
            $this->modelVersion = (string) $modelVersion;
        }
        return $this;
    }

    public function getCategory(): Category
    {
        return $this->category;
    }

    public function setCategory(null|Category|int|string $category): self
    {
        if ($category === null || $category === '') {
            $this->category = Category::LLM;
        } elseif ($category instanceof Category) {
            $this->category = $category;
        } else {
            $this->category = Category::from((string) $category);
        }
        return $this;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(null|int|string $modelId): self
    {
        if ($modelId === null) {
            $this->modelId = '';
        } else {
            $this->modelId = (string) $modelId;
        }
        return $this;
    }

    public function getModelType(): ModelType
    {
        return $this->modelType;
    }

    public function setModelType(null|int|ModelType|string $modelType): self
    {
        if ($modelType === null || $modelType === '') {
            $this->modelType = ModelType::LLM;
        } elseif ($modelType instanceof ModelType) {
            $this->modelType = $modelType;
        } else {
            $this->modelType = ModelType::from((int) $modelType);
        }
        return $this;
    }

    public function getConfig(): ?ModelConfigItem
    {
        return $this->config ?? null;
    }

    public function setConfig(null|array|ModelConfigItem|string $config): self
    {
        if ($config instanceof ModelConfigItem) {
            $this->config = $config;
        } elseif (is_string($config) && json_validate($config)) {
            $decoded = Json::decode($config);
            $this->config = new ModelConfigItem(is_array($decoded) ? $decoded : []);
        } elseif (is_array($config)) {
            $this->config = new ModelConfigItem($config);
        } else {
            $this->config = null;
        }
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(null|int|string $description): self
    {
        if ($description === null) {
            $this->description = '';
        } else {
            $this->description = (string) $description;
        }
        return $this;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): self
    {
        if ($sort === null) {
            $this->sort = 0;
        } else {
            $this->sort = (int) $sort;
        }
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(null|int|string $icon): self
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
        return $this;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(null|DateTime|string $createdAt): self
    {
        if ($createdAt === null) {
            $this->createdAt = null;
        } else {
            $this->createdAt = $createdAt instanceof DateTime ? $createdAt : new DateTime($createdAt);
        }
        return $this;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(null|DateTime|string $updatedAt): self
    {
        if ($updatedAt === null) {
            $this->updatedAt = null;
        } else {
            $this->updatedAt = $updatedAt instanceof DateTime ? $updatedAt : new DateTime($updatedAt);
        }
        return $this;
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(null|DateTime|string $deletedAt): self
    {
        if ($deletedAt === null) {
            $this->deletedAt = null;
        } else {
            $this->deletedAt = $deletedAt instanceof DateTime ? $deletedAt : new DateTime($deletedAt);
        }
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(null|int|string $organizationCode): self
    {
        if ($organizationCode === null) {
            $this->organizationCode = '';
        } else {
            $this->organizationCode = (string) $organizationCode;
        }
        return $this;
    }

    public function getStatus(): ?Status
    {
        return $this->status ?? null;
    }

    public function setStatus(null|int|Status|string $status): self
    {
        if ($status === null || $status === '') {
            $this->status = Status::Disabled;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } else {
            $this->status = Status::from((int) $status);
        }
        return $this;
    }

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

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(null|array|string $translate): self
    {
        if ($translate === null) {
            $this->translate = [];
        } elseif (is_string($translate)) {
            $decoded = Json::decode($translate);
            $this->translate = is_array($decoded) ? $decoded : [];
        } else {
            $this->translate = $translate;
        }
        return $this;
    }

    public function getModelParentId(): int
    {
        return $this->modelParentId;
    }

    public function setModelParentId(null|int|string $modelParentId): self
    {
        if (is_numeric($modelParentId)) {
            $this->modelParentId = (int) $modelParentId;
        } else {
            $this->modelParentId = 0;
        }
        return $this;
    }

    public function getVisibleOrganizations(): array
    {
        return $this->visibleOrganizations;
    }

    public function setVisibleOrganizations(null|array|string $visibleOrganizations): self
    {
        if ($visibleOrganizations === null) {
            $this->visibleOrganizations = [];
        } elseif (is_string($visibleOrganizations)) {
            $decoded = Json::decode($visibleOrganizations);
            $this->visibleOrganizations = is_array($decoded) ? $decoded : [];
        } else {
            $this->visibleOrganizations = $visibleOrganizations;
        }
        return $this;
    }

    public function getVisibleApplications(): array
    {
        return $this->visibleApplications;
    }

    public function setVisibleApplications(null|array|string $visibleApplications): self
    {
        if ($visibleApplications === null) {
            $this->visibleApplications = [];
        } elseif (is_string($visibleApplications)) {
            $decoded = Json::decode($visibleApplications);
            $this->visibleApplications = is_array($decoded) ? $decoded : [];
        } else {
            $this->visibleApplications = $visibleApplications;
        }
        return $this;
    }

    public function getVisiblePackages(): array
    {
        return $this->visiblePackages;
    }

    public function setVisiblePackages(null|array|string $visiblePackages): self
    {
        if ($visiblePackages === null) {
            $this->visiblePackages = [];
        } elseif (is_string($visiblePackages)) {
            $decoded = Json::decode($visiblePackages);
            $this->visiblePackages = is_array($decoded) ? $decoded : [];
        } else {
            $this->visiblePackages = $visiblePackages;
        }
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

    public function setIsOffice(null|bool|int|string $isOffice): self
    {
        if ($isOffice === null) {
            $this->isOffice = false;
        } elseif (is_string($isOffice)) {
            $this->isOffice = in_array(strtolower($isOffice), ['true', '1', 'yes', 'on']);
        } else {
            $this->isOffice = (bool) $isOffice;
        }
        return $this;
    }

    public function isSuperMagicDisplayState(): int
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

    public function setLoadBalancingWeight(null|int|string $loadBalancingWeight): self
    {
        if ($loadBalancingWeight === null) {
            $this->loadBalancingWeight = null;
        } else {
            $this->loadBalancingWeight = (int) $loadBalancingWeight;
        }
        return $this;
    }

    public function valid(): void
    {
        if (empty($this->modelVersion)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.model_version_required'));
        }

        if (empty($this->modelId)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.model_id_required'));
        }

        if (! empty($this->name) && strlen($this->name) > 50) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.name_max_length'));
        }

        if (empty($this->name)) {
            $this->name = $this->getModelVersion();
        }

        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter);
        }

        if (! $this->config) {
            $this->config = new ModelConfigItem();
        }
    }

    public function i18n(string $languages): void
    {
        if (isset($this->translate['name'][$languages])) {
            $this->name = $this->translate['name'][$languages];
        }
    }

    /**
     * 获取本地化的模型名称.
     */
    public function getLocalizedName(string $locale): string
    {
        return $this->translate['name'][$locale]
            ?? $this->translate['name']['zh_CN']
            ?? $this->translate['name']['en_US']
            ?? $this->name;
    }

    /**
     * 获取本地化的模型描述.
     */
    public function getLocalizedDescription(string $locale): string
    {
        return $this->translate['description'][$locale]
            ?? $this->translate['description']['zh_CN']
            ?? $this->translate['description']['en_US']
            ?? $this->description;
    }
}
