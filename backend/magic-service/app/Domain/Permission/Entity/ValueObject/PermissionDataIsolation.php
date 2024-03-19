<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * 数据隔离 SaaS化
 * 显式传入，防止隐式传入，导致不知道哪些地方需要做隔离.
 */
class PermissionDataIsolation extends BaseDataIsolation
{
    public static function create(string $currentOrganizationCode = '', string $userId = ''): self
    {
        return new self($currentOrganizationCode, $userId);
    }
}
