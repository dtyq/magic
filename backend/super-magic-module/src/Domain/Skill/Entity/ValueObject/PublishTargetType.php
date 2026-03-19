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
     * Publish to the skill market.
     */
    case MARKET = 'MARKET';
}
