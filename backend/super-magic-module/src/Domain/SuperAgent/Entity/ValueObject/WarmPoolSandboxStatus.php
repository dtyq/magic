<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Lifecycle states of a single sandbox sitting in the warm pool.
 */
enum WarmPoolSandboxStatus: string
{
    case Creating = 'creating';
    case Ready = 'ready';
    case Claimed = 'claimed';
    case Dead = 'dead';

    public static function isClaimable(string $status): bool
    {
        return $status === self::Ready->value;
    }
}
