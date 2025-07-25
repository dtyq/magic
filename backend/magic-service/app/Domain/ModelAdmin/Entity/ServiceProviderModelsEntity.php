<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Entity;

use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ValueObject\ModelConfig;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Codec\Json;

use function Hyperf\Translation\__;

class ServiceProviderModelsEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $serviceProviderConfigId; // 服务商ID

    protected string $name = ''; // 模型名称

    protected string $modelVersion = ''; // 模型在服务商下的名称

    protected string $modelId = ''; // 模型真实ID

    protected string $icon = ''; // 图标

    protected string $category = ''; // 模型分类：llm/vlm

    protected ?ModelConfig $config = null; // 配置

    protected int $modelType; // 用于分组用:文生图，图生图 等

    protected ?string $description = ''; // 描述

    protected int $sort = 0;

    protected int $modelParentId = 0; // 模型父级ID

    protected array $translate = [];

    protected string $organizationCode = '';

    protected array $visibleOrganizations = [];

    protected array $visibleApplications = [];

    protected array $visiblePackages = [];

    protected int $status = Status::ACTIVE->value; // 状态

    protected int $isOffice = 0; // 是否为官方模型：0-否，1-是

    protected int $superMagicDisplayState = 0;

    protected ?string $disabledBy = ''; // 禁用来源：official-官方禁用，user-用户禁用，NULL-未禁用

    protected string $createdAt;

    protected string $updatedAt;

    protected ?string $deletedAt;

    public function valid()
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
        $modelType = ModelType::tryFrom($this->getModelType());
        if (! $modelType) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.model_type_required'));
        }
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '组织编码不可为空');
        }

        if (! $this->config) {
            $this->config = new ModelConfig();
        }
    }

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
        return $this->status === Status::ACTIVE->value;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function isOffice(): bool
    {
        return $this->isOffice === 1;
    }

    public function getIsOffice(): int
    {
        return $this->isOffice;
    }

    public function setIsOffice(bool|int $isOffice): void
    {
        $this->isOffice = (int) $isOffice;
    }

    public function getSuperMagicDisplayState(): int
    {
        return $this->superMagicDisplayState;
    }

    public function setSuperMagicDisplayState(bool|int $superMagicDisplayState): void
    {
        $this->superMagicDisplayState = (int) $superMagicDisplayState;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = (int) $id;
    }

    public function getServiceProviderConfigId(): int
    {
        return $this->serviceProviderConfigId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function getModelType(): int
    {
        return $this->modelType;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setServiceProviderConfigId(int|string $serviceProviderConfigId): void
    {
        $this->serviceProviderConfigId = (int) $serviceProviderConfigId;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function setModelVersion(string $modelVersion): void
    {
        $this->modelVersion = $modelVersion;
    }

    public function setCategory(string $category): void
    {
        $this->category = $category;
    }

    public function setModelType(int $modelType): void
    {
        $this->modelType = $modelType;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function setUpdatedAt(string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function setConfig(null|array|ModelConfig|string $config): void
    {
        if (is_string($config)) {
            $config = new ModelConfig(Json::decode($config));
        }
        if (is_array($config)) {
            $config = new ModelConfig($config);
        }
        $this->config = $config;
    }

    public function getConfig(): ?ModelConfig
    {
        return $this->config;
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

    public function setTranslate(null|array|string $translate): void
    {
        if (is_string($translate)) {
            $translate = Json::decode($translate);
        }

        $this->translate = $translate;
    }

    public function i18n(string $languages)
    {
        if (isset($this->translate['name'][$languages])) {
            $this->name = $this->translate['name'][$languages];
        }
    }

    public function getModelParentId(): int
    {
        return $this->modelParentId;
    }

    public function getVisibleOrganizations(): array
    {
        return $this->visibleOrganizations;
    }

    public function setVisibleOrganizations(null|array|string $visibleOrganizations): void
    {
        if (is_string($visibleOrganizations)) {
            $visibleOrganizations = Json::decode($visibleOrganizations);
        }
        if (is_null($visibleOrganizations)) {
            $visibleOrganizations = [];
        }
        $this->visibleOrganizations = $visibleOrganizations;
    }

    public function getVisibleApplications(): array
    {
        return $this->visibleApplications;
    }

    public function setVisibleApplications(null|array|string $visibleApplications): void
    {
        if (is_string($visibleApplications)) {
            $visibleApplications = Json::decode($visibleApplications);
        }
        if (is_null($visibleApplications)) {
            $visibleApplications = [];
        }
        $this->visibleApplications = $visibleApplications;
    }

    public function setModelParentId(int $modelParentId): void
    {
        $this->modelParentId = $modelParentId;
    }

    public function getVisiblePackages(): array
    {
        return $this->visiblePackages;
    }

    public function setVisiblePackages(null|array|string $visiblePackages): void
    {
        if (is_string($visiblePackages)) {
            $visiblePackages = Json::decode($visiblePackages);
        }
        if (is_null($visiblePackages)) {
            $visiblePackages = [];
        }
        $this->visiblePackages = $visiblePackages;
    }
}
