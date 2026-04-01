<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\VideoCatalog\Entity\ValueObject;

readonly class VideoCatalogProviderDefinition
{
    public function __construct(
        private string $configId,
        private int $serviceProviderId,
        private string $name,
        private string $providerCode,
        private int $providerType,
        private string $category,
        private int $status,
        private string $icon,
        private string $description,
        private array $translate = [],
        private array $config = [],
        private array $decryptedConfig = [],
        private string $alias = '',
        private string $remark = '',
        private int $sort = 0,
    ) {
    }

    public function getConfigId(): string
    {
        return $this->configId;
    }

    public function getServiceProviderId(): int
    {
        return $this->serviceProviderId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getProviderCode(): string
    {
        return $this->providerCode;
    }

    public function getProviderType(): int
    {
        return $this->providerType;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function getDecryptedConfig(): array
    {
        return $this->decryptedConfig;
    }

    public function getAlias(): string
    {
        return $this->alias;
    }

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function getSort(): int
    {
        return $this->sort;
    }
}
