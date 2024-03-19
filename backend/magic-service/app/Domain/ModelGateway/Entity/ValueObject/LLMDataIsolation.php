<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

class LLMDataIsolation extends BaseDataIsolation
{
    public static function create(string $currentOrganizationCode = '', string $userId = ''): self
    {
        return new self($currentOrganizationCode, $userId);
    }
}
