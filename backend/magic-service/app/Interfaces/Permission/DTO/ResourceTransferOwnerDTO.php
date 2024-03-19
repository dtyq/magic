<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ResourceTransferOwnerDTO extends AbstractDTO
{
    public int $resourceType = 0;

    public string $resourceId = '';

    public string $userId = '';

    public bool $reserveManager = true;

    public function getResourceType(): int
    {
        return $this->resourceType;
    }

    public function setResourceType(int $resourceType): void
    {
        $this->resourceType = $resourceType;
    }

    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    public function setResourceId(string $resourceId): void
    {
        $this->resourceId = $resourceId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function isReserveManager(): bool
    {
        return $this->reserveManager;
    }

    public function setReserveManager(bool $reserveManager): void
    {
        $this->reserveManager = $reserveManager;
    }
}
