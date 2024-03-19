<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ShareableResourceDTO extends AbstractDTO
{
    /**
     * 资源ID.
     */
    public string $resourceId = '';

    /**
     * 资源类型.
     */
    public string $resourceType = '';

    /**
     * 资源名称.
     */
    public string $resourceName = '';

    /**
     * 资源所有者ID.
     */
    public string $ownerId = '';

    /**
     * 资源描述.
     */
    public string $description = '';

    /**
     * 创建时间.
     */
    public string $createdAt = '';

    /**
     * 更新时间.
     */
    public string $updatedAt = '';

    /**
     * 附加属性.
     */
    public array $extraAttributes = [];

    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    public function setResourceId(string $resourceId): void
    {
        $this->resourceId = $resourceId;
    }

    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    public function setResourceType(string $resourceType): void
    {
        $this->resourceType = $resourceType;
    }

    public function getResourceName(): string
    {
        return $this->resourceName;
    }

    public function setResourceName(string $resourceName): void
    {
        $this->resourceName = $resourceName;
    }

    public function getOwnerId(): string
    {
        return $this->ownerId;
    }

    public function setOwnerId(string $ownerId): void
    {
        $this->ownerId = $ownerId;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
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

    public function getExtraAttributes(): array
    {
        return $this->extraAttributes;
    }

    public function setExtraAttributes(array $extraAttributes): void
    {
        $this->extraAttributes = $extraAttributes;
    }
}
