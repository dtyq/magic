<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Permission;

enum Operation: int
{
    case Read = 1;
    case Write = 2;
    case All = 7;
}
