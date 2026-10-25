<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

enum AssetStatus: int
{
    case DISABLED = 0;
    case ENABLED = 1;

    public function isEnabled(): bool
    {
        return $this === self::ENABLED;
    }
}
