<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\DataIsolation\ValueObject;

enum OrganizationStatus: int
{
    /**
     * 正常.
     */
    case Normal = 1;

    /**
     * 禁用.
     */
    case Disabled = 2;
}
