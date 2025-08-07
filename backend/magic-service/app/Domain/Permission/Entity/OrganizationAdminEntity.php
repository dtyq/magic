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

/**
 * 组织管理员实体.
 */
class OrganizationAdminEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $userId;

    protected string $organizationCode;

    protected ?string $magicId = null;

    protected ?string $grantorUserId = null;

    protected ?DateTime $grantedAt = null;

    protected int $status = 1; // 状态: 0=禁用, 1=启用

    protected bool $isOrganizationCreator = false; // 是否为组织创建人

    protected ?string $remarks = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

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

        if (empty($this->grantedAt)) {
            $this->grantedAt = $this->createdAt;
        }

        $this->id = null;
    }

    public function prepareForModification(): void
    {
        $this->validate();
        $this->updatedAt = new DateTime();
    }

    public function isEnabled(): bool
    {
        return $this->status === 1;
    }

    public function enable(): void
    {
        $this->status = 1;
    }

    public function disable(): void
    {
        $this->status = 0;
    }

    public function grant(string $grantorUserId): void
    {
        $this->grantorUserId = $grantorUserId;
        $this->grantedAt = new DateTime();
        $this->status = 1;
    }

    public function revoke(): void
    {
        $this->status = 0;
    }

    // Getters and Setters
    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getMagicId(): ?string
    {
        return $this->magicId;
    }

    public function setMagicId(?string $magicId): void
    {
        $this->magicId = $magicId;
    }

    public function getGrantorUserId(): ?string
    {
        return $this->grantorUserId;
    }

    public function setGrantorUserId(?string $grantorUserId): void
    {
        $this->grantorUserId = $grantorUserId;
    }

    public function getGrantedAt(): ?DateTime
    {
        return $this->grantedAt;
    }

    public function setGrantedAt(?DateTime $grantedAt): void
    {
        $this->grantedAt = $grantedAt;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
    {
        $this->status = $status;
    }

    public function getRemarks(): ?string
    {
        return $this->remarks;
    }

    public function setRemarks(?string $remarks): void
    {
        $this->remarks = $remarks;
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

    public function isOrganizationCreator(): bool
    {
        return $this->isOrganizationCreator;
    }

    public function setIsOrganizationCreator(bool $isOrganizationCreator): void
    {
        $this->isOrganizationCreator = $isOrganizationCreator;
    }

    public function markAsOrganizationCreator(): void
    {
        $this->isOrganizationCreator = true;
    }

    public function unmarkAsOrganizationCreator(): void
    {
        $this->isOrganizationCreator = false;
    }

    protected function validate(): void
    {
        if (empty($this->userId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'user_id']);
        }

        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }

        if (! in_array($this->status, [0, 1])) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.invalid_status');
        }
    }
}
