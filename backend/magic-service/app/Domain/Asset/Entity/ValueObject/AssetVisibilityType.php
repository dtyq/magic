<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

enum AssetVisibilityType: string
{
    case PERSONAL = 'PERSONAL';
    case TEAM = 'TEAM';
}
