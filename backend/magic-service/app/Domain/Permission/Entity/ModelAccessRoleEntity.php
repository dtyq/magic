<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity;

use App\Domain\Permission\Entity\ValueObject\ModelAccessRoleBindingScopeType;
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

    protected ?string $createdUid = null;

    protected ?string $updatedUid = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected array $deniedModelIds = [];

    protected array $userIds = [];

    protected array $departmentIds = [];

    protected bool $allUsers = false;

    protected string $exclusionScopeType = ModelAccessRoleBindingScopeType::Specific->value;

    protected array $excludedUserIds = [];

    protected array $excludedDepartmentIds = [];

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
        if ($this->allUsers && (! empty($this->userIds) || ! empty($this->departmentIds))) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'organization_all binding_scope cannot include user_ids or department_ids');
        }

        $this->deniedModelIds = array_values(array_unique(array_filter(array_map('strval', $this->deniedModelIds), static fn ($id) => $id !== '')));
        $this->userIds = array_values(array_unique(array_filter(array_map('strval', $this->userIds), static fn ($id) => $id !== '')));
        $this->departmentIds = array_values(array_unique(array_filter(array_map('strval', $this->departmentIds), static fn ($id) => $id !== '')));
        $this->excludedUserIds = array_values(array_unique(array_filter(array_map('strval', $this->excludedUserIds), static fn ($id) => $id !== '')));
        $this->excludedDepartmentIds = array_values(array_unique(array_filter(array_map('strval', $this->excludedDepartmentIds), static fn ($id) => $id !== '')));

        if ($this->allUsers) {
            $this->userIds = [];
            $this->departmentIds = [];
        }

        if ($this->exclusionScopeType !== ModelAccessRoleBindingScopeType::Specific->value) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'exclusion_scope type must be specific');
        }
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

    public function getDepartmentIds(): array
    {
        return $this->departmentIds;
    }

    public function setDepartmentIds(array $departmentIds): void
    {
        $this->departmentIds = $departmentIds;
    }

    public function isAllUsers(): bool
    {
        return $this->allUsers;
    }

    public function setAllUsers(bool $allUsers): void
    {
        $this->allUsers = $allUsers;
    }

    public function getExclusionScopeType(): string
    {
        return $this->exclusionScopeType;
    }

    public function setExclusionScopeType(string $exclusionScopeType): void
    {
        $this->exclusionScopeType = $exclusionScopeType;
    }

    public function getExcludedUserIds(): array
    {
        return $this->excludedUserIds;
    }

    public function setExcludedUserIds(array $excludedUserIds): void
    {
        $this->excludedUserIds = $excludedUserIds;
    }

    public function getExcludedDepartmentIds(): array
    {
        return $this->excludedDepartmentIds;
    }

    public function setExcludedDepartmentIds(array $excludedDepartmentIds): void
    {
        $this->excludedDepartmentIds = $excludedDepartmentIds;
    }
}
