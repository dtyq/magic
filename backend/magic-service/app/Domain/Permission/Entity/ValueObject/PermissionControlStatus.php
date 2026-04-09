<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject;

enum PermissionControlStatus: string
{
    case UNINITIALIZED = 'uninitialized';
    case ENABLED = 'enabled';
    case DISABLED = 'disabled';
}
