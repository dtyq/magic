<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity;

use App\Infrastructure\Core\AbstractEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Hyperf\Database\Model\SoftDeletes;

/**
 * User-owned skill relation entity.
 */
class UserSkillEntity extends AbstractEntity
{
    use SoftDeletes;

    /**
     * Primary key ID.
     */
    protected ?int $id = null;

    /**
     * Organization code.
     */
    protected string $organizationCode;

    /**
     * Owner user ID.
     */
    protected string $userId;

    /**
     * Referenced skill code.
     */
    protected string $skillCode;

    /**
     * Installed skill version ID.
     */
    protected ?int $skillVersionId = null;

    /**
     * Ownership source type.
     */
    protected SkillSourceType $sourceType = SkillSourceType::LOCAL_UPLOAD;

    /**
     * Source record ID.
     */
    protected ?int $sourceId = null;

    /**
     * Created timestamp.
     */
    protected ?string $createdAt = null;

    /**
     * Updated timestamp.
     */
    protected ?string $updatedAt = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function toArray(): array
    {
        $result = [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'skill_code' => $this->skillCode,
            'skill_version_id' => $this->skillVersionId,
            'source_type' => $this->sourceType->value,
            'source_id' => $this->sourceId,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];

        return array_filter($result, static fn ($value) => $value !== null);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        $this->id = is_string($id) ? (int) $id : $id;
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

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getSkillCode(): string
    {
        return $this->skillCode;
    }

    public function setSkillCode(string $skillCode): self
    {
        $this->skillCode = $skillCode;
        return $this;
    }

    public function getSkillVersionId(): ?int
    {
        return $this->skillVersionId;
    }

    public function setSkillVersionId(null|int|string $skillVersionId): self
    {
        if ($skillVersionId === null) {
            $this->skillVersionId = null;
        } else {
            $this->skillVersionId = is_string($skillVersionId) ? (int) $skillVersionId : $skillVersionId;
        }
        return $this;
    }

    public function getSourceType(): SkillSourceType
    {
        return $this->sourceType;
    }

    public function setSourceType(SkillSourceType|string $sourceType): self
    {
        $this->sourceType = $sourceType instanceof SkillSourceType ? $sourceType : SkillSourceType::from($sourceType);
        return $this;
    }

    public function getSourceId(): ?int
    {
        return $this->sourceId;
    }

    public function setSourceId(null|int|string $sourceId): self
    {
        if ($sourceId === null) {
            $this->sourceId = null;
        } else {
            $this->sourceId = is_string($sourceId) ? (int) $sourceId : $sourceId;
        }
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }
}
