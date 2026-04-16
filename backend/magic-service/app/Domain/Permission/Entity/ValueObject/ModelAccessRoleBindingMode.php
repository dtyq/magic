<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject;

enum ModelAccessRoleBindingMode: int
{
    case INCLUDE = 1;
    case EXCLUDE = 2;
}
