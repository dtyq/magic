<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

enum UserAccountDataStatus: string
{
    case Available = 'available';
    case None = 'none';
    case Unsupported = 'unsupported';
    case Unavailable = 'unavailable';
}
