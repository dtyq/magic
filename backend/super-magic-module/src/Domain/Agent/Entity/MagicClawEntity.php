<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity;

use App\Infrastructure\Core\AbstractEntity;

class MagicClawEntity extends AbstractEntity
{
    /**
     * Primary key ID.
     */
    protected ?int $id = null;

    /**
     * Unique claw code.
     */
    protected string $code = '';

    /**
     * Claw name.
     */
    protected string $name = '';

    /**
     * Claw description.
     */
    protected string $description = '';

    /**
     * Icon file key (stored in DB).
     */
    protected string $icon = '';

    /**
     * Icon file URL (transient, resolved at runtime).
     */
    protected string $iconFileUrl = '';

    /**
     * Organization code.
     */
    protected string $organizationCode = '';

    /**
     * Creator user ID.
     */
    protected string $userId = '';

    /**
     * Associated project ID.
     */
    protected ?int $projectId = null;

    /**
     * Creator user ID (audit field).
     */
    protected string $createdUid = '';

    /**
     * Last updater user ID (audit field).
     */
    protected string $updatedUid = '';

    /**
     * Creation time.
     */
    protected ?string $createdAt = null;

    /**
     * Last update time.
     */
    protected ?string $updatedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getIconFileUrl(): string
    {
        return $this->iconFileUrl;
    }

    public function setIconFileUrl(string $iconFileUrl): void
    {
        $this->iconFileUrl = $iconFileUrl;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(?int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(string $updatedUid): void
    {
        $this->updatedUid = $updatedUid;
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
}
