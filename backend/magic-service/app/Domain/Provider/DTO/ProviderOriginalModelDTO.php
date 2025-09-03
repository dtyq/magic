<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO;

use App\Domain\Provider\Entity\ValueObject\ProviderOriginalModelType;
use App\Infrastructure\Core\AbstractDTO;
use DateTime;

class ProviderOriginalModelDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $modelId = '';

    protected ProviderOriginalModelType $type;

    protected string $organizationCode = '';

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    protected ?DateTime $deletedAt = null;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string|null $id): void
    {
        if ($id === null) {
            $this->id = '';
        } else {
            $this->id = (string) $id;
        }
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(int|string|null $modelId): void
    {
        if ($modelId === null) {
            $this->modelId = '';
        } else {
            $this->modelId = (string) $modelId;
        }
    }

    public function getType(): ProviderOriginalModelType
    {
        return $this->type;
    }

    public function setType(int|ProviderOriginalModelType|string|null $type): void
    {
        if ($type === null || $type === '') {
            $this->type = ProviderOriginalModelType::System;
        } elseif ($type instanceof ProviderOriginalModelType) {
            $this->type = $type;
        } else {
            $this->type = ProviderOriginalModelType::from((int) $type);
        }
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(int|string|null $organizationCode): void
    {
        if ($organizationCode === null) {
            $this->organizationCode = '';
        } else {
            $this->organizationCode = (string) $organizationCode;
        }
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime|string $createdAt): void
    {
        $this->createdAt = $createdAt instanceof DateTime ? $createdAt : new DateTime($createdAt);
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime|string $updatedAt): void
    {
        $this->updatedAt = $updatedAt instanceof DateTime ? $updatedAt : new DateTime($updatedAt);
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(DateTime|string|null $deletedAt): void
    {
        if ($deletedAt === null) {
            $this->deletedAt = null;
        } else {
            $this->deletedAt = $deletedAt instanceof DateTime ? $deletedAt : new DateTime($deletedAt);
        }
    }
}
