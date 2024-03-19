<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity;

use App\Domain\Contact\Entity\ValueObject\UserIdRelationType;
use App\Domain\Contact\Entity\ValueObject\UserIdType;

/**
 * user_id 与 open_id/union_id的映射关系.
 */
class MagicUserIdRelationEntity extends AbstractEntity
{
    protected ?int $id;

    protected string $accountId;

    protected UserIdType $idType;

    protected string $idValue;

    protected UserIdRelationType $relationType;

    protected string $relationValue;

    protected string $createdAt;

    protected string $updatedAt;

    protected ?string $deletedAt;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getAccountId(): string
    {
        return $this->accountId;
    }

    public function setAccountId(int|string $accountId): void
    {
        if (is_int($accountId)) {
            $accountId = (string) $accountId;
        }
        $this->accountId = $accountId;
    }

    public function getIdType(): UserIdType
    {
        return $this->idType;
    }

    public function setIdType(string|UserIdType $idType): void
    {
        if (is_string($idType)) {
            $idType = UserIdType::tryFrom($idType);
        }
        $this->idType = $idType;
    }

    public function getIdValue(): string
    {
        return $this->idValue;
    }

    public function setIdValue(string $idValue): void
    {
        $this->idValue = $idValue;
    }

    public function getRelationType(): UserIdRelationType
    {
        return UserIdRelationType::getCaseFromUserIdType($this->getIdType());
    }

    public function setRelationType(int|UserIdRelationType $relationType): void
    {
        if (is_int($relationType)) {
            $relationType = UserIdRelationType::tryFrom($relationType);
        }
        $this->relationType = $relationType;
    }

    public function getRelationValue(): string
    {
        return $this->relationValue;
    }

    public function setRelationValue(string $relationValue): void
    {
        $this->relationValue = $relationValue;
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

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }
}
