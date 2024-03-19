<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

class ResourceAccessDTO extends AbstractDTO
{
    public int $resourceType = 0;

    public string $resourceId = '';

    /**
     * @var TargetOperationDTO[]
     */
    public array $targets = [];

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

    public function getTargets(): array
    {
        return $this->targets;
    }

    public function setTargets(array $targets): void
    {
        $list = [];
        foreach ($targets as $target) {
            if ($target instanceof TargetOperationDTO) {
                $list[] = $target;
            } elseif (is_array($target)) {
                $list[] = new TargetOperationDTO($target);
            }
        }
        $this->targets = $list;
    }
}
