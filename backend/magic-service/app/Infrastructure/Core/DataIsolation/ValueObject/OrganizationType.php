<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation\ValueObject;

enum OrganizationType: int
{
    /**
     * 团队组织.
     */
    case Team = 0;

    /**
     * 个人组织.
     */
    case Personal = 1;
}
