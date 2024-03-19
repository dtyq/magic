<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * Skill 数据隔离.
 * 显式传入，防止隐式传入，导致不知道哪些地方需要做隔离.
 */
class SkillDataIsolation extends BaseDataIsolation
{
    public static function create(string $currentOrganizationCode = '', string $userId = '', string $magicId = ''): self
    {
        return new self($currentOrganizationCode, $userId, $magicId);
    }
}
