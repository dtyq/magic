<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

/**
 * 资源可见性实体.
 */
class ResourceVisibilityEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected PrincipalType $principalType;

    protected string $principalId;

    protected ResourceType $resourceType;

    protected string $resourceCode;

    protected string $creator;

    protected string $modifier;

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

        $this->id = null;
    }

    public function prepareForModification(): void
    {
        $this->validate();
        $this->updatedAt = new DateTime();
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

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getPrincipalType(): PrincipalType
    {
        return $this->principalType;
    }

    public function setPrincipalType(PrincipalType $principalType): void
    {
        $this->principalType = $principalType;
    }

    public function getPrincipalId(): string
    {
        return $this->principalId;
    }

    public function setPrincipalId(string $principalId): void
    {
        $this->principalId = $principalId;
    }

    public function getResourceType(): ResourceType
    {
        return $this->resourceType;
    }

    public function setResourceType(ResourceType $resourceType): void
    {
        $this->resourceType = $resourceType;
    }

    public function getResourceCode(): string
    {
        return $this->resourceCode;
    }

    public function setResourceCode(string $resourceCode): void
    {
        $this->resourceCode = $resourceCode;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
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

    protected function validate(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }

        if (empty($this->principalId)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'principal_id']);
        }

        if (empty($this->resourceCode)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'resource_code']);
        }

        if (empty($this->creator)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }

        if (empty($this->modifier)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.empty', ['label' => 'modifier']);
        }
    }
}
