<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * Design 领域数据隔离器.
 */
class DesignDataIsolation extends BaseDataIsolation
{
    public static function create(string $currentOrganizationCode = '', string $userId = '', string $magicId = ''): self
    {
        return new self($currentOrganizationCode, $userId, $magicId);
    }
}
