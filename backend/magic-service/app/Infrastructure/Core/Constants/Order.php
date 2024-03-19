<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Constants;

enum Order: string
{
    case Asc = 'asc';
    case Desc = 'desc';
}
