<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 创建文件版本响应 DTO.
 */
class CreateFileVersionResponseDTO extends AbstractDTO
{
    /**
     * 创建空响应实例.
     */
    public static function createEmpty(): self
    {
        return new self();
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [];
    }
}
