<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity;

use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Entity\ValueObject\ThirdPlatformIdMappingType;

/**
 * 第三方平台与麦吉的部门、用户、组织编码、空间编码等的映射关系记录.
 */
class MagicThirdPlatformIdMappingEntity extends AbstractEntity
{
    protected string $id;

    protected string $originId;

    protected string $newId;

    protected string $magicOrganizationCode;

    // magic_environment_id
    protected int $magicEnvironmentId = 0;

    protected PlatformType $thirdPlatformType;

    protected ThirdPlatformIdMappingType $mappingType;

    protected string $createdAt;

    protected string $updatedAt;

    protected ?string $deletedAt;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getMagicEnvironmentId(): int
    {
        return $this->magicEnvironmentId;
    }

    public function setMagicEnvironmentId(int $magicEnvironmentId): void
    {
        $this->magicEnvironmentId = $magicEnvironmentId;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(int|string $id): void
    {
        if (is_int($id)) {
            $id = (string) $id;
        }
        $this->id = $id;
    }

    public function getOriginId(): string
    {
        return $this->originId;
    }

    public function setOriginId(string $originId): void
    {
        $this->originId = $originId;
    }

    public function getNewId(): string
    {
        return $this->newId;
    }

    public function setNewId(string $newId): void
    {
        $this->newId = $newId;
    }

    public function getMappingType(): ThirdPlatformIdMappingType
    {
        return $this->mappingType;
    }

    public function setMappingType(string|ThirdPlatformIdMappingType $mappingType): void
    {
        if (is_string($mappingType)) {
            $mappingType = ThirdPlatformIdMappingType::from($mappingType);
        }
        $this->mappingType = $mappingType;
    }

    public function getThirdPlatformType(): PlatformType
    {
        return $this->thirdPlatformType;
    }

    public function setThirdPlatformType(PlatformType|string $thirdPlatformType): void
    {
        if (is_string($thirdPlatformType)) {
            $thirdPlatformType = PlatformType::from($thirdPlatformType);
        }
        $this->thirdPlatformType = $thirdPlatformType;
    }

    public function getMagicOrganizationCode(): string
    {
        return $this->magicOrganizationCode;
    }

    public function setMagicOrganizationCode(string $magicOrganizationCode): void
    {
        $this->magicOrganizationCode = $magicOrganizationCode;
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
