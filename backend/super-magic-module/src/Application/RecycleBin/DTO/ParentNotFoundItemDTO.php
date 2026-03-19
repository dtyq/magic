<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

/**
 * 父级不存在的项 DTO.
 */
class ParentNotFoundItemDTO
{
    public string $id = '';

    public int $resourceType;

    public string $resourceId = '';

    public string $resourceName = '';

    public ?string $parentId = null;

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'resource_type' => $this->resourceType,
            'resource_id' => $this->resourceId,
            'resource_name' => $this->resourceName,
            'parent_id' => $this->parentId,
        ];
    }
}
