<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

class SuperMagicAgentDataIsolation extends BaseDataIsolation
{
    public static function create(string $currentOrganizationCode = '', string $userId = ''): self
    {
        return new self($currentOrganizationCode, $userId);
    }
}
