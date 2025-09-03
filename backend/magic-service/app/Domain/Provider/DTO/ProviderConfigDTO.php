<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Util\StringMaskUtil;
use Hyperf\Codec\Json;

/**
 * service_provider_config_id 对应的服务商+模型列表。
 *
 * 同一个服务商在不同的组织下有不同的 service_provider_config_id。
 * 一个service_provider_config_id对应多个具体的模型。
 */
class ProviderConfigDTO extends AbstractDTO
{
    /**
     * service_provider_config_id 的值
     */
    protected string $id = '';

    protected string $name = '';

    protected string $description = '';

    protected string $icon = '';

    protected string $alias = '';

    protected string $serviceProviderId = '';

    /**
     * 大模型的具体配置，ak,sk,host 之类（已脱敏）.
     */
    protected ?ProviderConfigItem $config = null;

    /**
     * 已解密的配置，不进行数据脱敏处理.
     */
    protected ?ProviderConfigItem $decryptedConfig = null;

    protected ?ProviderType $providerType = null;

    protected ?Category $category = null;

    protected ?Status $status = null;

    protected array $translate = [];

    protected bool $isModelsEnable = true;

    /**
     * 为了接口兼容，固定返回空数组.
     */
    protected array $models = [];

    protected string $createdAt = '';

    protected ?ProviderCode $providerCode = null;

    protected string $remark = '';

    protected int $sort = 0;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    // ===== 基础字段的Getter/Setter =====

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string|null $id): void
    {
        if ($id === null) {
            $this->id = '';
        } else {
            $this->id = (string) $id;
        }
    }

    public function getProviderCode(): ?ProviderCode
    {
        return $this->providerCode ?? null;
    }

    public function setProviderCode(int|ProviderCode|string|null $providerCode): void
    {
        if ($providerCode === null || $providerCode === '') {
            $this->providerCode = ProviderCode::Official;
        } elseif ($providerCode instanceof ProviderCode) {
            $this->providerCode = $providerCode;
        } else {
            $this->providerCode = ProviderCode::from((string) $providerCode);
        }
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(int|string|null $name): void
    {
        if ($name === null) {
            $this->name = '';
        } else {
            $this->name = (string) $name;
        }
    }

    public function getProviderType(): ?ProviderType
    {
        return $this->providerType ?? null;
    }

    public function setProviderType(int|ProviderType|string|null $providerType): void
    {
        if ($providerType === null || $providerType === '') {
            $this->providerType = ProviderType::Normal;
        } elseif ($providerType instanceof ProviderType) {
            $this->providerType = $providerType;
        } else {
            $this->providerType = ProviderType::from((int) $providerType);
        }
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(int|string|null $description): void
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

    public function setIcon(int|string|null $icon): void
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
    }

    public function getCategory(): ?Category
    {
        return $this->category ?? null;
    }

    public function setCategory(Category|int|string|null $category): void
    {
        if ($category === null || $category === '') {
            $this->category = Category::LLM;
        } elseif ($category instanceof Category) {
            $this->category = $category;
        } else {
            $this->category = Category::from((string) $category);
        }
    }

    public function getStatus(): ?Status
    {
        return $this->status ?? null;
    }

    public function setStatus(int|Status|string|null $status): void
    {
        if ($status === null || $status === '') {
            $this->status = Status::Disabled;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } else {
            $this->status = Status::from((int) $status);
        }
    }

    public function isEnabled(): bool
    {
        return ($this->status ?? null) === Status::Enabled;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(int|string|null $createdAt): void
    {
        if ($createdAt === null) {
            $this->createdAt = '';
        } else {
            $this->createdAt = (string) $createdAt;
        }
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(array|string|null $translate): void
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

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function setRemark(int|string|null $remark): void
    {
        if ($remark === null) {
            $this->remark = '';
        } else {
            $this->remark = (string) $remark;
        }
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int|string|null $sort): void
    {
        if ($sort === null) {
            $this->sort = 0;
        } else {
            $this->sort = (int) $sort;
        }
    }

    // ===== 配置相关字段的Getter/Setter =====

    public function getAlias(): string
    {
        return $this->alias;
    }

    public function setAlias(int|string|null $alias): void
    {
        if ($alias === null) {
            $this->alias = '';
        } else {
            $this->alias = (string) $alias;
        }
    }

    public function getServiceProviderId(): string
    {
        return $this->serviceProviderId;
    }

    public function setServiceProviderId(int|string|null $serviceProviderId): void
    {
        if ($serviceProviderId === null) {
            $this->serviceProviderId = '';
        } else {
            $this->serviceProviderId = (string) $serviceProviderId;
        }
    }

    public function getConfig(): ?ProviderConfigItem
    {
        return $this->config;
    }

    public function updateConfig(ProviderConfigItem $configItem): void
    {
        $this->config = $configItem;
    }

    public function setConfig(array|ProviderConfigItem|string|null $config): void
    {
        if ($config === null) {
            $this->config = null;
        } elseif (is_string($config)) {
            $decoded = Json::decode($config);
            $config = new ProviderConfigItem(is_array($decoded) ? $decoded : []);
        } elseif (is_array($config)) {
            $config = new ProviderConfigItem($config);
        }

        // 数据脱敏处理
        if ($config instanceof ProviderConfigItem) {
            $config->setAk(StringMaskUtil::mask($config->getAk()));
            $config->setApiKey(StringMaskUtil::mask($config->getApiKey()));
            $config->setSk(StringMaskUtil::mask($config->getSk()));
        }

        $this->config = $config;
    }

    public function getDecryptedConfig(): ?ProviderConfigItem
    {
        return $this->decryptedConfig;
    }

    public function setDecryptedConfig(array|ProviderConfigItem|string|null $decryptedConfig): void
    {
        if ($decryptedConfig === null) {
            $this->decryptedConfig = null;
        } elseif (is_string($decryptedConfig)) {
            $decoded = Json::decode($decryptedConfig);
            $this->decryptedConfig = new ProviderConfigItem(is_array($decoded) ? $decoded : []);
        } elseif (is_array($decryptedConfig)) {
            $this->decryptedConfig = new ProviderConfigItem($decryptedConfig);
        } else {
            $this->decryptedConfig = $decryptedConfig;
        }

        // 注意：已解密的配置不进行数据脱敏处理
    }

    public function getIsModelsEnable(): bool
    {
        return $this->isModelsEnable;
    }

    public function setIsModelsEnable(bool|int|string|null $isModelsEnable): void
    {
        if ($isModelsEnable === null) {
            $this->isModelsEnable = false;
        } elseif (is_string($isModelsEnable)) {
            $this->isModelsEnable = in_array(strtolower($isModelsEnable), ['true', '1', 'yes', 'on']);
        } else {
            $this->isModelsEnable = (bool) $isModelsEnable;
        }
    }

    // ===== 模型相关字段的Getter/Setter =====

    /**
     * @return ProviderModelDetailDTO[]
     */
    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array|string|null $models): void
    {
        if ($models === null) {
            $this->models = [];
        } elseif (is_string($models)) {
            $decoded = Json::decode($models);
            $this->models = is_array($decoded) ? $decoded : [];
        } else {
            $this->models = $models;
        }
    }

    public function hasModels(): bool
    {
        return ! empty($this->models);
    }

    public function getServiceProviderType(): ?ProviderType
    {
        return $this->providerType ?? null;
    }

    public function setServiceProviderType(int|ProviderType|string|null $serviceProviderType): void
    {
        if ($serviceProviderType === null || $serviceProviderType === '') {
            $this->providerType = ProviderType::Normal;
        } elseif ($serviceProviderType instanceof ProviderType) {
            $this->providerType = $serviceProviderType;
        } else {
            $this->providerType = ProviderType::from((int) $serviceProviderType);
        }
    }

    public function getServiceProviderCode(): ?ProviderCode
    {
        return $this->providerCode ?? null;
    }

    public function setServiceProviderCode(int|ProviderCode|string|null $serviceProviderCode): self
    {
        $this->setProviderCode($serviceProviderCode);
        return $this;
    }

    public function addModel(ProviderModelEntity $model): void
    {
        // 把model转换为ProviderModelDetailDTO
        $modelDTO = new ProviderModelDetailDTO($model->toArray());
        $this->models[] = $modelDTO;
    }
}
