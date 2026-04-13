<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 活跃模型列表项DTO
 * 用于返回状态激活的模型列表（模型和服务商配置都为激活状态）.
 */
class ProviderModelItemDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $name = '';

    protected string $modelId = '';

    protected int $modelType = 0;

    protected string $category = '';

    protected string $icon = '';

    protected string $description = '';

    protected string $serviceProviderConfigId = '';

    protected ?array $imageSizeConfig = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        if ($id === null) {
            $this->id = '';
        } else {
            $this->id = (string) $id;
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

    public function getModelType(): int
    {
        return $this->modelType;
    }

    public function setModelType(null|int|string $modelType): self
    {
        if ($modelType === null) {
            $this->modelType = 0;
        } else {
            $this->modelType = (int) $modelType;
        }
        return $this;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(null|int|string $category): self
    {
        if ($category === null) {
            $this->category = '';
        } else {
            $this->category = (string) $category;
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

    public function getServiceProviderConfigId(): string
    {
        return $this->serviceProviderConfigId;
    }

    public function setServiceProviderConfigId(null|int|string $serviceProviderConfigId): self
    {
        if ($serviceProviderConfigId === null) {
            $this->{$serviceProviderConfigId} = '';
        } else {
            $this->serviceProviderConfigId = (string) $serviceProviderConfigId;
        }
        return $this;
    }

    public function getImageSizeConfig(): ?array
    {
        return $this->imageSizeConfig;
    }

    public function setImageSizeConfig(?array $imageSizeConfig): self
    {
        if (empty($imageSizeConfig)) {
            $this->imageSizeConfig = null;
            return $this;
        }

        $this->imageSizeConfig = [
            'sizes' => $imageSizeConfig['sizes'] ?? [],
            'max_reference_images' => $imageSizeConfig['max_reference_images'] ?? 0,
        ];
        return $this;
    }
}
