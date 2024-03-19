<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Permission;

enum TargetType: int
{
    case OpenPlatformApp = 1;
    case ApiKey = 2;
}
