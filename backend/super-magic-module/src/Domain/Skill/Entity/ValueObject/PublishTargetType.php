<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

/**
 * Skill publish target type.
 */
enum PublishTargetType: string
{
    /**
     * Publish privately for personal use.
     */
    case PRIVATE = 'PRIVATE';

    /**
     * Publish to specific members or departments.
     */
    case MEMBER = 'MEMBER';

    /**
     * Publish organization-wide.
     */
    case ORGANIZATION = 'ORGANIZATION';

    /**
     * Publish to the skill market.
     */
    case MARKET = 'MARKET';

    public function requiresTargetValue(): bool
    {
        return $this === self::MEMBER;
    }
}
