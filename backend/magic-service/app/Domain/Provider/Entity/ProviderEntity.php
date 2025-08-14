<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;
use Hyperf\Codec\Json;

class ProviderEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $name;

    protected ProviderCode $providerCode;

    protected string $description = '';

    protected string $icon = '';

    protected ProviderType $providerType;

    protected Category $category;

    protected Status $status;

    protected int $isModelsEnable;

    protected array $translate = [];

    protected string $remark = '';

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    protected ?DateTime $deletedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_numeric($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = null;
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

    public function getProviderCode(): ProviderCode
    {
        return $this->providerCode;
    }

    public function setProviderCode(null|int|ProviderCode|string $providerCode): void
    {
        if ($providerCode === null || $providerCode === '') {
            $this->providerCode = ProviderCode::Official;
        } elseif ($providerCode instanceof ProviderCode) {
            $this->providerCode = $providerCode;
        } else {
            $this->providerCode = ProviderCode::from((string) $providerCode);
        }
    }

    public function getDescription(): ?string
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

    public function getIcon(): ?string
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

    public function getProviderType(): ProviderType
    {
        return $this->providerType;
    }

    public function setProviderType(null|int|ProviderType|string $providerType): void
    {
        if ($providerType === null || $providerType === '') {
            $this->providerType = ProviderType::Normal;
        } elseif ($providerType instanceof ProviderType) {
            $this->providerType = $providerType;
        } else {
            $this->providerType = ProviderType::from((int) $providerType);
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

    public function getIsModelsEnable(): int
    {
        return $this->isModelsEnable;
    }

    public function setIsModelsEnable(null|int|string $isModelsEnable): void
    {
        if ($isModelsEnable === null) {
            $this->isModelsEnable = 0;
        } else {
            $this->isModelsEnable = (int) $isModelsEnable;
        }
    }

    public function getTranslate(): ?array
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

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function setRemark(null|int|string $remark): void
    {
        if ($remark === null) {
            $this->remark = '';
        } else {
            $this->remark = (string) $remark;
        }
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime|string $createdAt): void
    {
        $this->createdAt = $createdAt instanceof DateTime ? $createdAt : new DateTime($createdAt);
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime|string $updatedAt): void
    {
        $this->updatedAt = $updatedAt instanceof DateTime ? $updatedAt : new DateTime($updatedAt);
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(null|DateTime|string $deletedAt): void
    {
        if ($deletedAt === null) {
            $this->deletedAt = null;
        } else {
            $this->deletedAt = $deletedAt instanceof DateTime ? $deletedAt : new DateTime($deletedAt);
        }
    }

    public function i18n(string $languages): void
    {
        if (isset($this->translate['name'][$languages])) {
            $this->name = $this->translate['name'][$languages];
        }
        if (isset($this->translate['description'][$languages])) {
            $this->description = $this->translate['description'][$languages];
        }
    }

    /**
     * 获取本地化的服务商名称.
     */
    public function getLocalizedName(string $locale): string
    {
        return $this->translate['name'][$locale]
            ?? $this->translate['name']['zh_CN']
            ?? $this->translate['name']['en_US']
            ?? $this->name;
    }
}
