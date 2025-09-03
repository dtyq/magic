<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\DTO;

use App\Domain\Contact\Entity\AbstractEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Infrastructure\Core\Contract\Session\LoginResponseInterface;

class LoginResponseDTO extends AbstractEntity implements LoginResponseInterface
{
    protected string $magicId = '';

    protected string $magicUserId = '';

    protected string $organizationName = '';

    protected ?string $organizationLogo = null;

    protected string $magicOrganizationCode = '';

    protected string $thirdPlatformOrganizationCode = '';

    protected string $thirdPlatformUserId = '';

    protected ?PlatformType $thirdPlatformType = null;

    public function getMagicId(): string
    {
        return $this->magicId;
    }

    public function setMagicId(string $magicId): static
    {
        $this->magicId = $magicId;
        return $this;
    }

    public function getMagicUserId(): string
    {
        return $this->magicUserId;
    }

    public function setMagicUserId(string $magicUserId): static
    {
        $this->magicUserId = $magicUserId;
        return $this;
    }

    public function getMagicOrganizationCode(): string
    {
        return $this->magicOrganizationCode;
    }

    public function setMagicOrganizationCode(string $magicOrganizationCode): static
    {
        $this->magicOrganizationCode = $magicOrganizationCode;
        return $this;
    }

    public function getThirdPlatformOrganizationCode(): string
    {
        return $this->thirdPlatformOrganizationCode ?? '';
    }

    public function setThirdPlatformOrganizationCode(string $thirdPlatformOrganizationCode): static
    {
        $this->thirdPlatformOrganizationCode = $thirdPlatformOrganizationCode;
        return $this;
    }

    public function getThirdPlatformUserId(): string
    {
        return $this->thirdPlatformUserId ?? '';
    }

    public function setThirdPlatformUserId(string $thirdPlatformUserId): static
    {
        $this->thirdPlatformUserId = $thirdPlatformUserId;
        return $this;
    }

    public function getThirdPlatformType(): PlatformType
    {
        return $this->thirdPlatformType;
    }

    public function setThirdPlatformType(null|PlatformType|string $thirdPlatformType): static
    {
        if (is_null($thirdPlatformType)) {
            $this->thirdPlatformType = null;
            return $this;
        }
        if ($thirdPlatformType instanceof PlatformType) {
            $this->thirdPlatformType = $thirdPlatformType;
        } else {
            $this->thirdPlatformType = PlatformType::from($thirdPlatformType);
        }
        return $this;
    }

    public function getOrganizationName(): string
    {
        return $this->organizationName ?? '';
    }

    public function setOrganizationName(string $organizationName): static
    {
        $this->organizationName = $organizationName;
        return $this;
    }

    public function getOrganizationLogo(): ?string
    {
        return $this->organizationLogo ?? null;
    }

    public function setOrganizationLogo(?string $organizationLogo): static
    {
        $this->organizationLogo = $organizationLogo;
        return $this;
    }
}
