<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Entity\ValueObject;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * 文件领域数据隔离。
 * 显式传入，避免文件凭证生成依赖隐式认证上下文。
 */
class FileDataIsolation extends BaseDataIsolation
{
    /**
     * 创建文件领域数据隔离对象。
     */
    public static function create(string $currentOrganizationCode = '', string $userId = '', string $magicId = ''): self
    {
        return new self($currentOrganizationCode, $userId, $magicId);
    }
}
