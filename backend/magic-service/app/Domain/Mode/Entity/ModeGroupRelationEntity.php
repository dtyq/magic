<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Entity;

use App\Infrastructure\Core\AbstractEntity;

class ModeGroupRelationEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $modeId = 0;

    protected int $providerModelId = 0;

    protected int $groupId = 0;

    protected string $modelId = '';

    protected int $sort = 0;

    protected string $organizationCode = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(int|string $id): self
    {
        $this->id = (int) $id;
        return $this;
    }

    public function getModeId(): int
    {
        return $this->modeId;
    }

    public function setModeId(int|string $modeId): self
    {
        $this->modeId = (int) $modeId;
        return $this;
    }

    public function getGroupId(): int
    {
        return $this->groupId;
    }

    public function setGroupId(int|string $groupId): self
    {
        $this->groupId = (int) $groupId;
        return $this;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): void
    {
        $this->sort = $sort;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
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

    public function setProviderModelId(int|string $providerModelId): void
    {
        $this->providerModelId = (int) $providerModelId;
    }
}
