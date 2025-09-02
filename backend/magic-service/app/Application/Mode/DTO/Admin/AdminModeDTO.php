<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\Admin;

use App\Domain\Mode\Entity\DistributionTypeEnum;
use App\Infrastructure\Core\AbstractDTO;

class AdminModeDTO extends AbstractDTO
{
    protected string $id;

    protected array $nameI18n;

    protected array $placeholderI18n = [];

    protected string $identifier;

    protected string $icon = '';

    protected ?string $color = null;

    protected ?string $description = null;

    protected DistributionTypeEnum $distributionType = DistributionTypeEnum::INDEPENDENT;

    protected ?string $followModeId = null;

    protected int $isDefault;

    protected bool $status;

    protected int $sort;

    protected ?string $createdAt = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        $this->id = (string) $id;
    }

    public function getNameI18n(): array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(array $nameI18n): void
    {
        $this->nameI18n = $nameI18n;
    }

    public function getPlaceholderI18n(): array
    {
        return $this->placeholderI18n;
    }

    public function setPlaceholderI18n(array $placeholderI18n): void
    {
        $this->placeholderI18n = $placeholderI18n;
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

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(?string $color): void
    {
        $this->color = $color;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    public function getDistributionType(): DistributionTypeEnum
    {
        return $this->distributionType;
    }

    public function setDistributionType(DistributionTypeEnum|int $distributionType): void
    {
        $this->distributionType = $distributionType instanceof DistributionTypeEnum ? $distributionType : DistributionTypeEnum::from($distributionType);
    }

    public function getFollowModeId(): ?string
    {
        return $this->followModeId;
    }

    public function setFollowModeId(null|int|string $followModeId): void
    {
        if (is_int($followModeId)) {
            $followModeId = (string) $followModeId;
        }
        $this->followModeId = $followModeId;
    }

    public function getIsDefault(): int
    {
        return $this->isDefault;
    }

    public function setIsDefault(int $isDefault): void
    {
        $this->isDefault = $isDefault;
    }

    public function getStatus(): bool
    {
        return $this->status;
    }

    public function setStatus(bool $status): void
    {
        $this->status = $status;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function isEnabled(): bool
    {
        return $this->status;
    }
}
