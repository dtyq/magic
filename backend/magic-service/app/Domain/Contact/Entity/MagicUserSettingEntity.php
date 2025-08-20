<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity;

use DateTime;

class MagicUserSettingEntity extends AbstractEntity
{
    private ?int $id = null;

    private ?string $magicId = '';

    private ?string $organizationCode = '';

    private ?string $userId = '';

    private string $key = '';

    private array $value = [];

    private string $creator = '';

    private DateTime $createdAt;

    private string $modifier = '';

    private DateTime $updatedAt;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getMagicId(): ?string
    {
        return $this->magicId;
    }

    public function setMagicId(?string $magicId): void
    {
        $this->magicId = $magicId;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId;
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function setKey(string $key): void
    {
        $this->key = $key;
    }

    public function getValue(): array
    {
        return $this->value;
    }

    public function setValue(array $value): void
    {
        $this->value = $value;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function shouldCreate(): bool
    {
        return $this->id === null;
    }

    public function prepareForCreation(): void
    {
        $this->createdAt = new DateTime();
        $this->updatedAt = new DateTime();
        $this->modifier = $this->creator;
    }

    public function prepareForModification(MagicUserSettingEntity $existingEntity): void
    {
        $this->id = $existingEntity->getId();
        $this->magicId = $existingEntity->getMagicId();
        $this->organizationCode = $existingEntity->getOrganizationCode();
        $this->createdAt = $existingEntity->getCreatedAt();
        $this->creator = $existingEntity->getCreator();
        $this->updatedAt = new DateTime();
        $this->modifier = $this->creator;
    }
}
