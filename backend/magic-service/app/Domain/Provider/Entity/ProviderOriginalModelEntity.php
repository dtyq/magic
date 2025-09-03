<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\Entity\ValueObject\ProviderOriginalModelType;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class ProviderOriginalModelEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $modelId = '';

    protected ProviderOriginalModelType $type;

    protected string $organizationCode = '';

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    protected ?DateTime $deletedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_numeric($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = null;
        }
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(null|int|string $modelId): void
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

    public function setType(null|int|ProviderOriginalModelType|string $type): void
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

    public function setOrganizationCode(null|int|string $organizationCode): void
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

    public function setDeletedAt(null|DateTime|string $deletedAt): void
    {
        if ($deletedAt === null) {
            $this->deletedAt = null;
        } else {
            $this->deletedAt = $deletedAt instanceof DateTime ? $deletedAt : new DateTime($deletedAt);
        }
    }
}
