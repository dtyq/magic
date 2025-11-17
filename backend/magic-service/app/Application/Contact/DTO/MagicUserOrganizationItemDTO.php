<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\DTO;

use App\Infrastructure\Core\AbstractDTO;

class MagicUserOrganizationItemDTO extends AbstractDTO
{
    protected string $magicOrganizationCode = '';

    protected string $name = '';

    protected int $organizationType = 0;

    protected ?string $logo = null;

    protected bool $isCurrent = false;

    protected bool $isAdmin = false;

    protected bool $isCreator = false;

    protected ?string $productName = '';

    protected int $seats = 0;

    protected ?string $planType = null;

    protected ?string $subscriptionTier = null;

    public function getMagicOrganizationCode(): string
    {
        return $this->magicOrganizationCode;
    }

    public function setMagicOrganizationCode(string $magicOrganizationCode): void
    {
        $this->magicOrganizationCode = $magicOrganizationCode;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getOrganizationType(): int
    {
        return $this->organizationType;
    }

    public function setOrganizationType(int $organizationType): void
    {
        $this->organizationType = $organizationType;
    }

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function setLogo(?string $logo): void
    {
        $this->logo = $logo;
    }

    public function isCurrent(): bool
    {
        return $this->isCurrent;
    }

    public function setIsCurrent(bool $isCurrent): void
    {
        $this->isCurrent = $isCurrent;
    }

    public function isAdmin(): bool
    {
        return $this->isAdmin;
    }

    public function setIsAdmin(bool $isAdmin): void
    {
        $this->isAdmin = $isAdmin;
    }

    public function isCreator(): bool
    {
        return $this->isCreator;
    }

    public function setIsCreator(bool $isCreator): void
    {
        $this->isCreator = $isCreator;
    }

    public function getProductName(): ?string
    {
        return $this->productName;
    }

    public function setProductName(?string $productName): void
    {
        $this->productName = $productName;
    }

    public function getSeats(): int
    {
        return $this->seats;
    }

    public function setSeats(?int $seats): void
    {
        $this->seats = $seats ?? 0;
    }

    public function getPlanType(): ?string
    {
        return $this->planType;
    }

    public function setPlanType(?string $planType): void
    {
        $this->planType = $planType;
    }

    public function getSubscriptionTier(): ?string
    {
        return $this->subscriptionTier;
    }

    public function setSubscriptionTier(?string $subscriptionTier): void
    {
        $this->subscriptionTier = $subscriptionTier;
    }
}
