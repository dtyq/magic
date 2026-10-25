<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SlidesTemplate\Entity;

use App\Infrastructure\Core\AbstractEntity;

class SlidesTemplateFavoriteEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode = '';

    protected string $userId = '';

    protected string $slideTemplateCode = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    public function toArray(): array
    {
        return array_filter([
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'slide_template_code' => $this->slideTemplateCode,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ], static fn ($value) => $value !== null);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        $this->id = $id === null ? null : (int) $id;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = trim($organizationCode);
        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = trim($userId);
        return $this;
    }

    public function getSlideTemplateCode(): string
    {
        return $this->slideTemplateCode;
    }

    public function setSlideTemplateCode(string $slideTemplateCode): self
    {
        $this->slideTemplateCode = trim($slideTemplateCode);
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): self
    {
        $this->createdAt = $createdAt === null ? null : (string) $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): self
    {
        $this->updatedAt = $updatedAt === null ? null : (string) $updatedAt;
        return $this;
    }
}
