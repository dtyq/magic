<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject;

enum ProviderType: int
{
    case Normal = 0;
    case Official = 1;
    case Custom = 2;

    public function label(): string
    {
        return match ($this) {
            self::Normal => '普通',
            self::Official => '官方',
            self::Custom => '自定义',
        };
    }

    public function isCustom(): bool
    {
        return $this === self::Custom;
    }
}
