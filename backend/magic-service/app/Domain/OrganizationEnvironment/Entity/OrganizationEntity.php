<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

/**
 * 组织实体.
 */
class OrganizationEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $magicOrganizationCode = '';

    protected string $name = '';

    protected ?string $platformType = null;

    protected ?string $logo = null;

    protected ?string $introduction = null;

    protected ?string $contactUser = null;

    protected ?string $contactMobile = null;

    protected string $industryType = '';

    protected ?string $number = null;

    protected int $status = 1; // 状态: 1=正常, 2=禁用

    protected ?string $creatorId = null;

    protected int $type = 0; // 组织类型 0:团队组织 1:个人组织

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected ?DateTime $deletedAt = null;

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForCreation(): void
    {
        $this->validate();

        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }

        if (empty($this->updatedAt)) {
            $this->updatedAt = $this->createdAt;
        }

        $this->id = null;
    }

    public function prepareForModification(): void
    {
        $this->validate();
        $this->updatedAt = new DateTime();
    }

    public function isNormal(): bool
    {
        return $this->status === 1;
    }

    public function enable(): void
    {
        $this->status = 1;
    }

    public function disable(): void
    {
        $this->status = 2;
    }

    // Getters and Setters
    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (int) $id : null;
    }

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

    public function getPlatformType(): ?string
    {
        return $this->platformType;
    }

    public function setPlatformType(?string $platformType): void
    {
        $this->platformType = $platformType;
    }

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function setLogo(?string $logo): void
    {
        $this->logo = $logo;
    }

    public function getIntroduction(): ?string
    {
        return $this->introduction;
    }

    public function setIntroduction(?string $introduction): void
    {
        $this->introduction = $introduction;
    }

    public function getContactUser(): ?string
    {
        return $this->contactUser;
    }

    public function setContactUser(?string $contactUser): void
    {
        $this->contactUser = $contactUser;
    }

    public function getContactMobile(): ?string
    {
        return $this->contactMobile;
    }

    public function setContactMobile(?string $contactMobile): void
    {
        $this->contactMobile = $contactMobile;
    }

    public function getIndustryType(): string
    {
        return $this->industryType;
    }

    public function setIndustryType(string $industryType): void
    {
        $this->industryType = $industryType;
    }

    public function getNumber(): ?string
    {
        return $this->number;
    }

    public function setNumber(?string $number): void
    {
        $this->number = $number;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function getCreatorId(): ?string
    {
        return $this->creatorId;
    }

    public function setCreatorId(?string $creatorId): void
    {
        $this->creatorId = $creatorId;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): void
    {
        $this->type = $type;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?DateTime $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    protected function validate(): void
    {
        if (empty($this->magicOrganizationCode)) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_CODE_REQUIRED);
        }

        if (empty($this->name)) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_NAME_REQUIRED);
        }

        if (empty($this->industryType)) {
            ExceptionBuilder::throw(PermissionErrorCode::ORGANIZATION_INDUSTRY_TYPE_REQUIRED);
        }
    }
}
