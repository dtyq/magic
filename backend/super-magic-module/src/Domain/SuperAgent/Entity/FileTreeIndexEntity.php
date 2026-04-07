<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity;

use App\Infrastructure\Core\AbstractEntity;

class FileTreeIndexEntity extends AbstractEntity
{
    protected int $id = 0;

    protected int $ancestorId = 0;

    protected int $descendantId = 0;

    protected int $distance = 0;

    protected string $organizationCode = '';

    protected string $createdAt = '';

    protected string $updatedAt = '';

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function getAncestorId(): int
    {
        return $this->ancestorId;
    }

    public function setAncestorId(int $ancestorId): void
    {
        $this->ancestorId = $ancestorId;
    }

    public function getDescendantId(): int
    {
        return $this->descendantId;
    }

    public function setDescendantId(int $descendantId): void
    {
        $this->descendantId = $descendantId;
    }

    public function getDistance(): int
    {
        return $this->distance;
    }

    public function setDistance(int $distance): void
    {
        $this->distance = $distance;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'ancestor_id' => $this->ancestorId,
            'descendant_id' => $this->descendantId,
            'distance' => $this->distance,
            'organization_code' => $this->organizationCode,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
