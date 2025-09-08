<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Entity;

use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Util\Context\CoContext;

class ModeEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected array $nameI18n = [];

    protected array $placeholderI18n = [];

    protected string $identifier = '';

    protected string $icon = '';

    protected string $color = '';

    protected string $description = '';

    protected int $sort = 0;

    protected int $isDefault = 0;

    protected bool $status = true;

    protected DistributionTypeEnum $distributionType = DistributionTypeEnum::INDEPENDENT;

    protected int $followModeId = 0;

    protected array $restrictedModeIdentifiers = [];

    protected string $organizationCode = '';

    protected string $creatorId = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected ?string $deletedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int|string $id): self
    {
        $this->id = (int) $id;
        return $this;
    }

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): void
    {
        $this->nameI18n = $nameI18n;
    }

    public function getZHName(): string
    {
        return $this->nameI18n['zh_CN'] ?? '';
    }

    public function getENName(): string
    {
        return $this->nameI18n['en_US'] ?? '';
    }

    public function getName()
    {
        $language = CoContext::getLanguage();
        return $this->nameI18n[$language] ?? $this->getZHName();
    }

    public function getPlaceholderI18n(): array
    {
        return $this->placeholderI18n;
    }

    public function setPlaceholderI18n(array $placeholderI18n): void
    {
        $this->placeholderI18n = $placeholderI18n;
    }

    public function getZHPlaceholder(): string
    {
        return $this->placeholderI18n['zh_CN'] ?? '';
    }

    public function getENPlaceholder(): string
    {
        return $this->placeholderI18n['en_US'] ?? '';
    }

    public function getPlaceholder(): string
    {
        $language = CoContext::getLanguage();
        return $this->placeholderI18n[$language] ?? $this->getZHPlaceholder();
    }

    public function getIdentifier(): string
    {
        return $this->identifier;
    }

    public function setIdentifier(string $identifier): void
    {
        $this->identifier = $identifier;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getColor(): string
    {
        return $this->color;
    }

    public function setColor(string $color): void
    {
        $this->color = $color;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getIsDefault(): int
    {
        return $this->isDefault;
    }

    public function setIsDefault(int $isDefault): void
    {
        $this->isDefault = $isDefault;
    }

    public function isDefaultMode(): bool
    {
        return $this->isDefault === 1;
    }

    public function getStatus(): bool
    {
        return $this->status;
    }

    public function setStatus(bool $status): void
    {
        $this->status = $status;
    }

    public function isEnabled(): bool
    {
        return $this->status;
    }

    public function getDistributionType(): DistributionTypeEnum
    {
        return $this->distributionType;
    }

    public function setDistributionType(DistributionTypeEnum|int $distributionType): void
    {
        $this->distributionType = $distributionType instanceof DistributionTypeEnum ? $distributionType : DistributionTypeEnum::fromValue($distributionType);
    }

    public function isIndependentConfiguration(): bool
    {
        return $this->distributionType === DistributionTypeEnum::INDEPENDENT->value;
    }

    public function isInheritedConfiguration(): bool
    {
        return $this->distributionType === DistributionTypeEnum::INHERITED;
    }

    public function getFollowModeId(): int
    {
        return $this->followModeId;
    }

    public function setFollowModeId(null|int|string $followModeId): self
    {
        if (is_null($followModeId)) {
            $followModeId = 0;
        }
        $this->followModeId = (int) $followModeId;
        return $this;
    }

    public function hasFollowMode(): bool
    {
        return $this->followModeId !== 0;
    }

    public function getRestrictedModeIdentifiers(): array
    {
        return $this->restrictedModeIdentifiers;
    }

    public function setRestrictedModeIdentifiers(array $restrictedModeIdentifiers): void
    {
        $this->restrictedModeIdentifiers = $restrictedModeIdentifiers;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCreatorId(): string
    {
        return $this->creatorId;
    }

    public function setCreatorId(string $creatorId): void
    {
        $this->creatorId = $creatorId;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function canBeDeleted(): bool
    {
        return ! $this->isDefaultMode();
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }
}
