<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\VideoCatalog\Entity\ValueObject;

readonly class VideoCatalogModelDefinition
{
    public function __construct(
        private int $id,
        private string $serviceProviderConfigId,
        private string $modelId,
        private string $name,
        private string $modelVersion,
        private string $description,
        private string $icon,
        private int $modelType,
        private string $category,
        private int $status,
        private array $translate = [],
        private array $config = [],
        private array $runtimeConfig = [],
        private string $providerCode = 'Wuyin',
        private int $sort = 0,
    ) {
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getServiceProviderConfigId(): string
    {
        return $this->serviceProviderConfigId;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function getModelType(): int
    {
        return $this->modelType;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function getRuntimeConfig(): array
    {
        return $this->runtimeConfig;
    }

    public function getProviderCode(): string
    {
        return $this->providerCode;
    }

    public function getSort(): int
    {
        return $this->sort;
    }
}
