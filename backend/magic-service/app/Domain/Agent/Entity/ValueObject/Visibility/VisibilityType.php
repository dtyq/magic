<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Entity\ValueObject\Visibility;

enum VisibilityType: int
{
    case All = 1;
    case SPECIFIC = 2;
}
