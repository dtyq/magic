<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 资源可见性DTO.
 */
class ResourceVisibilityDTO extends AbstractDTO
{
    /**
     * 资源类型.
     */
    public int $resourceType = 0;

    /**
     * 资源编码.
     */
    public string $resourceCode = '';

    /**
     * 目标主体列表.
     *
     * @var TargetVisibilityDTO[]
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

    public function getResourceCode(): string
    {
        return $this->resourceCode;
    }

    public function setResourceCode(string $resourceCode): void
    {
        $this->resourceCode = $resourceCode;
    }

    public function getTargets(): array
    {
        return $this->targets;
    }

    public function setTargets(array $targets): void
    {
        $list = [];
        foreach ($targets as $target) {
            if ($target instanceof TargetVisibilityDTO) {
                $list[] = $target;
            } elseif (is_array($target)) {
                $list[] = new TargetVisibilityDTO($target);
            }
        }
        $this->targets = $list;
    }
}
