<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum Code: string
{
    case SuperMagicAgent = 'SMA';

    public function gen(): string
    {
        return $this->value . '-' . str_replace('.', '-', uniqid('', true));
    }
}
