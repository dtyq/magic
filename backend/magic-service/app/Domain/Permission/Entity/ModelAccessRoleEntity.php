<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class ModelAccessRoleEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode = '';

    protected string $name = '';

    protected ?string $description = null;

    protected bool $isDefault = false;

    protected ?int $parentRoleId = null;

    protected ?string $createdUid = null;

    protected ?string $updatedUid = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected array $deniedModelIds = [];

    protected array $userIds = [];

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForCreation(string $userId): void
    {
        $this->validate();
        $this->createdUid = $userId;
        $this->updatedUid = $userId;
        $this->createdAt ??= new DateTime();
        $this->updatedAt ??= $this->createdAt;
        $this->id = null;
    }

    public function prepareForModification(string $userId): void
    {
        $this->validate();
        $this->updatedUid = $userId;
        $this->updatedAt = new DateTime();
    }

    public function validate(): void
    {
        if ($this->organizationCode === '') {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'organization_code is required');
        }
        if ($this->name === '') {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'role_name is required');
        }
        if (mb_strlen($this->name) > 255) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'role_name too long');
        }
        if ($this->isDefault) {
            $this->parentRoleId = null;
            if (! empty($this->userIds)) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'default role cannot bind users');
            }
        } elseif ($this->parentRoleId !== null && $this->parentRoleId <= 0) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'parent_role_id is invalid');
        }

        $this->deniedModelIds = array_values(array_unique(array_filter(array_map('strval', $this->deniedModelIds), static fn ($id) => $id !== '')));
        $this->userIds = array_values(array_unique(array_filter(array_map('strval', $this->userIds), static fn ($id) => $id !== '')));
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = trim($name);
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description === null ? null : trim($description);
    }

    public function isDefault(): bool
    {
        return $this->isDefault;
    }

    public function setIsDefault(bool $isDefault): void
    {
        $this->isDefault = $isDefault;
    }

    public function getParentRoleId(): ?int
    {
        return $this->parentRoleId;
    }

    public function setParentRoleId(?int $parentRoleId): void
    {
        $this->parentRoleId = $parentRoleId;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(?string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getUpdatedUid(): ?string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(?string $updatedUid): void
    {
        $this->updatedUid = $updatedUid;
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

    public function getDeniedModelIds(): array
    {
        return $this->deniedModelIds;
    }

    public function setDeniedModelIds(array $deniedModelIds): void
    {
        $this->deniedModelIds = $deniedModelIds;
    }

    public function getUserIds(): array
    {
        return $this->userIds;
    }

    public function setUserIds(array $userIds): void
    {
        $this->userIds = $userIds;
    }
}
