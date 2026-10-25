<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Entity\ValueObject\Query;

enum SkillListScope: string
{
    case ALL = 'all';
    case CREATED = 'created';
    case TEAM_SHARED = 'team_shared';
    case COLLABORATED = 'collaborated';
    case MARKET_INSTALLED = 'market_installed';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
