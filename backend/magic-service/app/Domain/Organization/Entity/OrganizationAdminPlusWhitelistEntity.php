<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Organization\Entity;

use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class OrganizationAdminPlusWhitelistEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode = '';

    protected int $enabled = 1;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected ?DateTime $deletedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function isEnabled(): bool
    {
        return $this->enabled === 1;
    }

    public function setEnabled(bool|int $enabled): self
    {
        $this->enabled = (int) $enabled;
        return $this;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?DateTime $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTime $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?DateTime $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }
}
