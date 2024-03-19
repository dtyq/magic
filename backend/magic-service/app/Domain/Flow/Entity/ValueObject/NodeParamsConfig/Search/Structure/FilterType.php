<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure;

enum FilterType: string
{
    case All = 'all';
    case Any = 'any';

    public function isAny(): bool
    {
        return $this === self::Any;
    }

    public function isAll(): bool
    {
        return $this === self::All;
    }
}
