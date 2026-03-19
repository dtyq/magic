<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

/**
 * 单个恢复结果 DTO.
 */
class RestoreResultItemDTO
{
    public string $id = '';

    public int $resourceType;

    public string $resourceId = '';

    public string $resourceName = '';

    public bool $success = true;

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
            'success' => $this->success,
        ];
    }
}
