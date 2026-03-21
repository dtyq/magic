<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum PublishTargetType: string
{
    case PRIVATE = 'PRIVATE';
    case MEMBER = 'MEMBER';
    case ORGANIZATION = 'ORGANIZATION';
    case MARKET = 'MARKET';

    public function requiresTargetValue(): bool
    {
        return match ($this) {
            self::MEMBER => true,
            self::PRIVATE, self::ORGANIZATION, self::MARKET => false,
        };
    }

    public function getLabel(): string
    {
        return match ($this) {
            self::PRIVATE => 'Private',
            self::MEMBER => 'Specific Members',
            self::ORGANIZATION => 'Organization-wide',
            self::MARKET => 'Crew Market',
        };
    }
}
