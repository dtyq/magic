<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

enum Status: int
{
    case Disabled = 0;
    case Enabled = 1;

    public function label(): string
    {
        return match ($this) {
            self::Disabled => '禁用',
            self::Enabled => '启用',
        };
    }

    public function isEnabled(): bool
    {
        return $this === self::Enabled;
    }
}
