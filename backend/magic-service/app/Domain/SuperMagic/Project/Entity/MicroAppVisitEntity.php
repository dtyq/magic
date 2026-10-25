<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Entity;

use App\Infrastructure\Core\AbstractEntity;

class MicroAppVisitEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $microAppId = 0;

    protected string $userId = '';

    protected string $organizationCode = '';

    protected ?string $lastVisitedAt = null;

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        $this->initProperty($data);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getMicroAppId(): int
    {
        return $this->microAppId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getLastVisitedAt(): ?string
    {
        return $this->lastVisitedAt;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setId(null|int|string $id): self
    {
        $this->id = $id === null ? null : (int) $id;
        return $this;
    }

    public function setMicroAppId(int|string $id): self
    {
        $this->microAppId = (int) $id;
        return $this;
    }

    public function setUserId(string $id): self
    {
        $this->userId = $id;
        return $this;
    }

    public function setOrganizationCode(string $code): self
    {
        $this->organizationCode = $code;
        return $this;
    }

    public function setLastVisitedAt(mixed $value): self
    {
        $this->lastVisitedAt = $value === null ? null : (string) $value;
        return $this;
    }

    public function setCreatedAt(mixed $value): self
    {
        $this->createdAt = $value === null ? null : (string) $value;
        return $this;
    }

    public function setUpdatedAt(mixed $value): self
    {
        $this->updatedAt = $value === null ? null : (string) $value;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'micro_app_id' => $this->microAppId,
            'user_id' => $this->userId,
            'organization_code' => $this->organizationCode,
            'last_visited_at' => $this->lastVisitedAt,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }
}
