<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum PublishTargetType: string
{
    case PRIVATE = 'PRIVATE';
    case USER = 'USER';
    case DEPARTMENT = 'DEPARTMENT';
    case ORGANIZATION = 'ORGANIZATION';
    case MARKET = 'MARKET';

    public function requiresTargetValue(): bool
    {
        return match ($this) {
            self::USER, self::DEPARTMENT, self::ORGANIZATION => true,
            self::PRIVATE, self::MARKET => false,
        };
    }

    public function getLabel(): string
    {
        return match ($this) {
            self::PRIVATE => 'Private',
            self::USER => 'Specific Members',
            self::DEPARTMENT => 'Departments',
            self::ORGANIZATION => 'Organization-wide',
            self::MARKET => 'Crew Market',
        };
    }
}
